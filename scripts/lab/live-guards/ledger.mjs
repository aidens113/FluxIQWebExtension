// The append-only spend ledger, `lab-slots/spend-ledger.jsonl`.
//
// Two kinds of line. `start` is written immediately before the runner is
// spawned, with the pid, the task and the source fingerprint; `finish` is
// written once per run the launch produced, with its runId, verdict,
// `observed.totalEstimatedCostUsd`, and its spend per build against the
// per-build ceiling the run was planned under (`buildCeilingUsd`,
// `maxBuildCostUsd`, `buildsOverCeiling`; null for a run that recorded no
// ceiling, and absent on entries written before they were recorded). The loop rule counts starts, so a run that
// crashes still counts; finishes carry each run's cost, so spend stays
// visible for reporting (`windowSpend`) without limiting any run. A start whose process is gone
// and has no finish is closed by `reconcileLedger` before the next admission.
//
// An unreadable line fails the read: the guards fail closed rather than
// answering from a ledger they could not read.

import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * @typedef {{ event: "start", launchId: string, at: string, pid: number, instance: string, scenarioId: string, task: string, fingerprint: string, repositoryRoot: string, runsDirectory: string, overridden: string[] }} StartEntry
 * @typedef {{ event: "finish", launchId: string, at: string, runId: string | null, instance: string, task: string, verdict: string | null, totalEstimatedCostUsd: number | null, buildCeilingUsd?: number | null, maxBuildCostUsd?: number | null, buildsOverCeiling?: number | null, balanceFailure: Record<string, unknown> | null, fingerprint: string, exitCode: number | null, reconciled?: true }} FinishEntry
 * @typedef {StartEntry | FinishEntry} LedgerEntry
 */

/**
 * @param {string} file
 * @returns {Promise<LedgerEntry[]>} empty when the ledger does not exist yet
 */
export async function readLedger(file) {
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const entries = [];
  const lines = text.split(/\r?\n/u);
  for (const [index, line] of lines.entries()) {
    if (line.trim() === "") continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch (error) {
      throw new Error(`${file} line ${index + 1} is not JSON (${error instanceof Error ? error.message : String(error)}); the live-run guards will not answer from a ledger they cannot read`);
    }
    if (entry?.event !== "start" && entry?.event !== "finish") throw new Error(`${file} line ${index + 1} is neither a start nor a finish entry`);
    entries.push(entry);
  }
  return entries;
}

/**
 * @param {string} file
 * @param {LedgerEntry} entry
 */
export async function appendLedgerEntry(file, entry) {
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, `${JSON.stringify(entry)}\n`, "utf8");
}
