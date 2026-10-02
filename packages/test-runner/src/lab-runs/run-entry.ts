import { readFile } from "node:fs/promises";

/**
 * `entry.json`, the one record a run keeps of itself in the central folder.
 * Written as the run starts (`verdict: "running"`, the Lab's `pid`) and
 * rewritten as it ends; the index is built from these files alone. It holds
 * names, paths, times and figures -- never a token, password or key.
 */
export type LabRunEntry = {
  runId: string;
  startedAt: string;
  pid: number;
  /** `FLUXIQ_LAB_LANE`, else `FLUXIQ_LAB_INSTANCE`, else `default`. */
  lane: string;
  instance: string;
  /** As the spend ledger names it (`ledgerTask`). */
  task: string;
  scenarioId: string;
  verdict: string;
  /** The run's evidence bundle, `<runsDir>/<runId>`; only a path, never a link. */
  bundlePath: string;
  repositoryRoot: string;
  /** Set as the run ends: `snapshots/live-llm.json`'s `observed.totalEstimatedCostUsd`, or `null` when it holds none. */
  costUsd?: number | null;
  finishedAt?: string;
  steps?: number;
};

/** Reads one run's `entry.json`: `null` when there is none, and a failure when one exists that is not an entry. */
export async function readRunEntry(file: string): Promise<LabRunEntry | null> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const value = JSON.parse(text) as Partial<LabRunEntry>;
  if (typeof value.runId !== "string" || typeof value.startedAt !== "string" || typeof value.verdict !== "string") throw new Error(`${file} is not a Lab run entry`);
  return value as LabRunEntry;
}
