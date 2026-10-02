import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { withDeadline } from "../run-scenario/index.js";
import { pathExists } from "./path-exists.js";

/** One picture of the run's browser, or `undefined` when no source produced one. The run's screenshot adapter answers exactly this. */
export type StepCapture = () => Promise<{ bytes: Uint8Array } | undefined>;

export type StepScreenshotWatcherInput = {
  stepsDirectory: string;
  capture: StepCapture;
  /** How often `steps/` is looked at; 1 s. */
  pollMs?: number;
  /** The whole budget of one capture; 5 s. A late picture is a picture that did not happen. */
  deadlineMs?: number;
  /** How long `stop` may spend photographing steps that finished since the last look; 5 s. */
  stopBudgetMs?: number;
  log?: (line: string) => void;
};

/** A step that acted on the page: Core's tool calls in the loop (`NNNN-tool-<toolId>`) and the build's test replays (`NNNN-test-<toolId>`). */
const PAGE_STEP = /^\d{4,}-(?:tool|test)-/u;
/** Core writes `meta.json` last, so a folder holding it is complete. */
const COMPLETE_MARKER = "meta.json";
const PICTURE_NAMES = ["screenshot.png", "screenshot.jpg", "screenshot.skipped.txt"] as const;
const POLL_MS = 1_000;
const DEADLINE_MS = 5_000;
const STOP_BUDGET_MS = 5_000;

/**
 * Puts a picture of the browser into each page step of a live run's `steps/`,
 * taken as soon as the step is seen complete, so a tool call's folder shows
 * what the page looked like after it. Only a step that is still the newest
 * page step is photographed: one the next page step has already acted after
 * -- a test's quick replays, mostly -- says so in `screenshot.skipped.txt`
 * rather than holding a picture of a later page.
 *
 * It polls rather than being told, because the steps are Core's and the
 * browser is the Lab's: the folder is the only thing both see. Captures run
 * one at a time, each under a deadline, through whatever capture the run
 * already uses -- the native window capture, which moves no focus, with the
 * front-tab fallback. A capture that fails or finds nothing writes
 * `screenshot.skipped.txt` with the reason; nothing here ever fails or holds up
 * the run. `stop` must be called before the browser closes: it photographs the
 * steps finished since the last look, inside its own budget, and marks the
 * rest skipped.
 */
export class StepScreenshotWatcher {
  private readonly handled = new Set<string>();
  private readonly log: (line: string) => void;
  private timer: NodeJS.Timeout | undefined;
  private scanning: Promise<void> | undefined;
  private started = false;
  private stopped = false;

  constructor(private readonly input: StepScreenshotWatcherInput) {
    this.log = input.log ?? (line => process.stderr.write(`${line}\n`));
  }

  start(): void {
    if (this.started || this.stopped) return;
    this.started = true;
    this.schedule();
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    await this.scanning;
    if (!this.started) return;
    const endsAt = Date.now() + (this.input.stopBudgetMs ?? STOP_BUDGET_MS);
    await this.scan({ endsAt });
  }

  private schedule(): void {
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.scanning = this.scan("poll").finally(() => {
        this.scanning = undefined;
        if (!this.stopped) this.schedule();
      });
    }, this.input.pollMs ?? POLL_MS);
    this.timer.unref?.();
  }

  /**
   * One look at `steps/`. A poll stops as soon as `stop` begins; the final look photographs until its budget runs out. Never rejects.
   *
   * Only the newest page step is photographed. A picture shows the page as it is now, so a step that a later page step
   * has already acted after is marked skipped rather than given a picture of the later state. The model's own steps
   * between two page steps leave the page as the first one left it, so they do not count as later.
   */
  private async scan(mode: "poll" | { endsAt: number }): Promise<void> {
    try {
      const pageSteps = (await stepFolders(this.input.stepsDirectory)).filter(name => PAGE_STEP.test(name));
      for (const [position, name] of pageSteps.entries()) {
        if (mode === "poll" && this.stopped) return;
        if (this.handled.has(name)) continue;
        const folder = path.join(this.input.stepsDirectory, name);
        if (!(await pathExists(path.join(folder, COMPLETE_MARKER)))) continue;
        this.handled.add(name);
        if ((await Promise.all(PICTURE_NAMES.map(picture => pathExists(path.join(folder, picture))))).some(Boolean)) continue;
        const later = pageSteps[position + 1];
        if (later !== undefined) await this.skip(folder, movedOn(later, "had already started when this step was seen complete"));
        else if (mode === "poll" || Date.now() < mode.endsAt) await this.photograph(folder, name);
        else await this.skip(folder, "the run ended before this step was photographed");
      }
    } catch (error) {
      this.log(`[lab runs] step screenshots: could not read ${this.input.stepsDirectory}: ${describe(error)}`);
    }
  }

  private async photograph(folder: string, name: string): Promise<void> {
    let reason: string;
    try {
      const shot = await withDeadline(() => this.input.capture(), this.input.deadlineMs ?? DEADLINE_MS, "The step screenshot");
      const extension = shot && shot.bytes.byteLength > 0 ? imageExtension(shot.bytes) : undefined;
      // A page step that started while the picture was being taken may already have changed the page in it.
      const later = shot && extension ? (await stepFolders(this.input.stepsDirectory)).find(other => PAGE_STEP.test(other) && stepNumber(other) > stepNumber(name)) : undefined;
      if (shot && extension && later === undefined) {
        await writeFile(path.join(folder, `screenshot.${extension}`), shot.bytes);
        return;
      }
      reason = later !== undefined
        ? movedOn(later, "started while this step's picture was being taken")
        : !shot || shot.bytes.byteLength === 0 ? "no capture source produced a picture (the run's stderr names each source's reason under [lab screenshots])" : "the capture returned bytes that are neither PNG nor JPEG";
    } catch (error) {
      reason = describe(error);
    }
    await this.skip(folder, reason);
  }

  private async skip(folder: string, reason: string): Promise<void> {
    try {
      await writeFile(path.join(folder, "screenshot.skipped.txt"), `${reason}\n`, "utf8");
    } catch (error) {
      this.log(`[lab runs] step screenshots: could not write the skip note in ${folder}: ${describe(error)}`);
    }
  }
}

/** The file extension of an image by its first bytes, which is its real format whatever the source claimed. */
function imageExtension(bytes: Uint8Array): "png" | "jpg" | undefined {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  return undefined;
}

/** The folders in `steps/`, in step order (by number, so `10000-` follows `9999-`); none while Core has not written its first step. */
async function stepFolders(stepsDirectory: string): Promise<string[]> {
  try {
    return (await readdir(stepsDirectory, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort((a, b) => stepNumber(a) - stepNumber(b) || a.localeCompare(b));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

/** A step folder's number, `NNNN-...`; 0 for anything else. */
function stepNumber(name: string): number {
  const digits = /^(\d+)-/u.exec(name)?.[1];
  return digits === undefined ? 0 : Number(digits);
}

/** Why a step has no picture: the page step after it had acted first. */
function movedOn(later: string, when: string): string {
  return `the page moved on: page step ${later} ${when}, so a picture now would show the page after that step, not this one`;
}


function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
