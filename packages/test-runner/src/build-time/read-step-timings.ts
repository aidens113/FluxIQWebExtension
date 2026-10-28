import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { StepTiming } from "./types.js";

/** A step folder Core writes: `NNNN-<kind>`, `NNNN-tool-<toolId>` or `NNNN-test-<toolId>`. */
const STEP_FOLDER = /^(\d{4,})-/u;

type Meta = Record<string, unknown>;

const text = (value: unknown): string | null => (typeof value === "string" && value.length > 0 ? value : null);

/** Reads `meta.json`; `null` when the step has none yet. A malformed file is a failure. */
async function readMeta(file: string): Promise<Meta | null> {
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  return JSON.parse(raw) as Meta;
}

/**
 * The timing of every step under a run's `steps/`, read from each
 * `meta.json` alone -- never a request, response, page view or picture.
 * `incomplete` names the step folders with no `meta.json`, or with no valid
 * start and finish (a step still running, or one a crash cut short).
 */
export async function readStepTimings(stepsDirectory: string): Promise<{ steps: StepTiming[]; incomplete: string[] }> {
  const steps: StepTiming[] = [];
  const incomplete: string[] = [];
  const entries = (await readdir(stepsDirectory, { withFileTypes: true })).filter(entry => entry.isDirectory() && STEP_FOLDER.test(entry.name));
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const meta = await readMeta(path.join(stepsDirectory, entry.name, "meta.json"));
    const start = Date.parse(String(meta?.startedAt));
    const end = Date.parse(String(meta?.finishedAt));
    const kind = text(meta?.kind);
    if (meta === null || kind === null || Number.isNaN(start) || Number.isNaN(end) || end < start) {
      incomplete.push(entry.name);
      continue;
    }
    steps.push({
      folder: entry.name,
      index: Number(STEP_FOLDER.exec(entry.name)![1]),
      kind,
      toolId: text(meta.toolId),
      callId: text(meta.callId),
      outcome: text(meta.outcome),
      phase: text(meta.phase),
      part: text(meta.part),
      provider: text(meta.provider),
      round: typeof meta.round === "number" ? meta.round : null,
      status: text(meta.status),
      start,
      end
    });
  }
  return { steps, incomplete };
}
