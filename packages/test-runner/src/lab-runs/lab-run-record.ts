import { mkdir, readFile, symlink } from "node:fs/promises";
import path from "node:path";
import { copyKeyFiles } from "./copy-key-files.js";
import { countSteps } from "./count-steps.js";
import { ledgerTask } from "./ledger-task.js";
import { localDateTime } from "./local-time.js";
import { regenerateRunsIndex, type RegenerateRunsIndexOptions } from "./regenerate-runs-index.js";
import type { LabRunEntry } from "./run-entry.js";
import { labRunsRoot } from "./runs-root.js";
import { StepScreenshotWatcher, type StepCapture, type StepScreenshotWatcherInput } from "./step-screenshot-watcher.js";
import { writeFileAtomically } from "./write-atomically.js";

export type LabRunRecordInput = {
  /** Where `FLUXIQ_LAB_RUNS_DIR`, `FLUXIQ_LAB_LANE` and `FLUXIQ_LAB_INSTANCE` are read; the process's own by default. */
  environment?: NodeJS.ProcessEnv;
  runId: string;
  /** The run's own start, ISO; its local date names the folder the run is filed under. */
  startedAt: string;
  scenarioId: string;
  /** What the run carries out: its instruction task's id, or the llm task. */
  work: string;
  workflowId?: string | undefined;
  variantId?: string | undefined;
  /** `<runsDir>/<runId>`, where the bundle will be once it is finalized. */
  bundlePath: string;
  repositoryRoot: string;
  pid?: number;
  log?: (line: string) => void;
  index?: Omit<RegenerateRunsIndexOptions, "log">;
};

/**
 * One live run's place in the machine-wide run folder,
 * `<lab-runs>/<YYYY-MM-DD>/<runId>/` (`labRunsRoot`).
 *
 * `open` creates the folder and its `steps/` before Core starts, so that Core
 * -- told the folder through `FLUXIQ_LLM_STEP_LOG_DIR` -- writes every model
 * and tool step there from its first call, and a run killed halfway still
 * leaves them. `watchSteps` puts a picture into each page step as it
 * completes. `close` runs once the bundle is finalized: it gives the bundle a
 * `steps` junction to these steps (they exist once on disk; one decision
 * request alone can be 1.4 MB), copies the bundle's key files here, records
 * the verdict, cost and step count, and rebuilds `lab-runs/index.md`.
 *
 * Everything here is best-effort. A failure is named on stderr and never fails
 * or holds up the run; a record that could not open does nothing afterwards,
 * and its run's Core is simply not given a step folder.
 */
export class LabRunRecord {
  private opened = false;
  private closed = false;
  private watcher: StepScreenshotWatcher | undefined;

  private constructor(readonly root: string, readonly folder: string, private entry: LabRunEntry, private readonly log: (line: string) => void, private readonly index: Omit<RegenerateRunsIndexOptions, "log">) {}

  static async open(input: LabRunRecordInput): Promise<LabRunRecord> {
    const environment = input.environment ?? process.env;
    const root = labRunsRoot(environment);
    const started = new Date(input.startedAt);
    const folder = path.join(root, localDateTime(Number.isNaN(started.getTime()) ? new Date() : started).date, input.runId);
    const instance = environment.FLUXIQ_LAB_INSTANCE?.trim() || "default";
    const entry: LabRunEntry = {
      runId: input.runId, startedAt: input.startedAt, pid: input.pid ?? process.pid, lane: environment.FLUXIQ_LAB_LANE?.trim() || instance, instance,
      task: ledgerTask({ scenarioId: input.scenarioId, work: input.work, workflowId: input.workflowId, variantId: input.variantId }), scenarioId: input.scenarioId,
      verdict: "running", bundlePath: input.bundlePath, repositoryRoot: input.repositoryRoot,
    };
    const record = new LabRunRecord(root, folder, entry, input.log ?? (line => process.stderr.write(`${line}\n`)), input.index ?? {});
    await record.attempt("open the run's folder", async () => {
      await mkdir(path.join(folder, "steps"), { recursive: true });
      await record.writeEntry();
      record.opened = true;
    });
    if (record.opened) await record.regenerate();
    return record;
  }

  /** The folder Core writes its steps into, once the record is open. */
  get stepsDirectory(): string | undefined {
    return this.opened ? path.join(this.folder, "steps") : undefined;
  }

  /** Starts photographing each completed page step; call once the browser is up. */
  watchSteps(capture: StepCapture, options: Omit<StepScreenshotWatcherInput, "stepsDirectory" | "capture" | "log"> = {}): void {
    const stepsDirectory = this.stepsDirectory;
    if (!stepsDirectory || this.watcher || this.closed) return;
    this.watcher = new StepScreenshotWatcher({ ...options, stepsDirectory, capture, log: this.log });
    this.watcher.start();
  }

  /** Stops the pictures; call before the browser closes. */
  async stopWatching(): Promise<void> {
    await this.watcher?.stop();
  }

  /**
   * Files the finished run. Runs once; a second call does nothing, so a caller
   * may close again on a path that did not reach the first. Without a
   * `bundlePath` only the verdict is recorded.
   */
  async close(input: { verdict: string; bundlePath?: string | undefined }): Promise<void> {
    if (!this.opened || this.closed) return;
    this.closed = true;
    await this.stopWatching();
    const steps = path.join(this.folder, "steps");
    let costUsd: number | null = null;
    const bundlePath = input.bundlePath;
    if (bundlePath) {
      // A junction, not a copy: the steps exist once on disk. Removing the bundle (`fs.rm` recursive, PowerShell's Remove-Item) unlinks it and keeps the target.
      await this.attempt("link the bundle's steps/ to the run's steps", () => symlink(steps, path.join(bundlePath, "steps"), "junction"));
      await copyKeyFiles(bundlePath, this.folder, this.log);
      await this.attempt("read the run's cost", async () => { costUsd = await readCostUsd(bundlePath); });
    }
    let stepCount = 0;
    await this.attempt("count the run's steps", async () => { stepCount = await countSteps(steps); });
    this.entry = { ...this.entry, verdict: input.verdict, costUsd, finishedAt: new Date().toISOString(), steps: stepCount };
    await this.attempt("update entry.json", () => this.writeEntry());
    await this.regenerate();
  }

  private async writeEntry(): Promise<void> {
    await writeFileAtomically(path.join(this.folder, "entry.json"), `${JSON.stringify(this.entry, null, 2)}\n`);
  }

  private async regenerate(): Promise<void> {
    await this.attempt("rebuild lab-runs/index.md", () => regenerateRunsIndex(this.root, { ...this.index, log: this.log }));
  }

  private async attempt(what: string, work: () => Promise<unknown>): Promise<void> {
    try {
      await work();
    } catch (error) {
      this.log(`[lab runs] could not ${what} (${this.folder}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/** `snapshots/live-llm.json`'s `observed.totalEstimatedCostUsd`, the figure the spend ledger records; `null` when the run wrote none. */
async function readCostUsd(bundlePath: string): Promise<number | null> {
  let text: string;
  try {
    text = await readFile(path.join(bundlePath, "snapshots", "live-llm.json"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const cost = (JSON.parse(text) as { observed?: { totalEstimatedCostUsd?: unknown } | null }).observed?.totalEstimatedCostUsd;
  return typeof cost === "number" && Number.isFinite(cost) ? cost : null;
}
