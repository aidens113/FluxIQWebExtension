// Writes a launch's finish entries, one per run it produced, and stops every
// later live run when one of them ended on an empty balance.
//
// Used for a launch that ended normally (`recordLiveRunFinish`) and for one
// whose launcher died without saying so (`reconcileLedger`). The runs it
// claims are those under the launch's runs directory that started after it
// and before the next launch into that directory, and that no finish entry
// already names.

import { writeFile } from "node:fs/promises";
import { appendLedgerEntry } from "./ledger.mjs";
import { readRunOutcomes } from "./run-outcomes.mjs";

/**
 * @param {ReturnType<typeof import("./guard-files.mjs").guardFiles>} files
 * @param {import("./ledger.mjs").StartEntry} start
 * @param {import("./ledger.mjs").LedgerEntry[]} entries the ledger as it stands
 * @param {{ exitCode: number | null, now: number, reconciled: boolean }} options
 * @returns {Promise<{ finishes: import("./ledger.mjs").FinishEntry[], stopped: string | null }>}
 */
export async function closeLaunch(files, start, entries, { exitCode, now, reconciled }) {
  const sinceMs = Date.parse(start.at);
  const knownRunIds = new Set(entries.filter((entry) => entry.event === "finish" && typeof entry.runId === "string").map((entry) => entry.runId));
  const later = entries
    .filter((entry) => entry.event === "start" && entry.runsDirectory === start.runsDirectory && Date.parse(entry.at) > sinceMs)
    .map((entry) => Date.parse(entry.at));
  const untilMs = later.length === 0 ? Infinity : Math.min(...later);
  const outcomes = (await readRunOutcomes(start.runsDirectory, { sinceMs, knownRunIds }))
    .filter((outcome) => outcome.startedAt === null || Date.parse(outcome.startedAt) < untilMs);

  const base = { event: "finish", launchId: start.launchId, at: new Date(now).toISOString(), instance: start.instance, task: start.task, fingerprint: start.fingerprint, exitCode };
  const marker = reconciled ? { reconciled: true } : {};
  const finishes = outcomes.length === 0
    ? [{ ...base, runId: null, verdict: null, totalEstimatedCostUsd: null, buildCeilingUsd: null, maxBuildCostUsd: null, buildsOverCeiling: null, balanceFailure: null, ...marker }]
    : outcomes.map((outcome) => ({
      ...base,
      runId: outcome.runId,
      verdict: outcome.verdict,
      totalEstimatedCostUsd: outcome.totalEstimatedCostUsd,
      buildCeilingUsd: outcome.buildCeilingUsd,
      maxBuildCostUsd: outcome.maxBuildCostUsd,
      buildsOverCeiling: outcome.buildsOverCeiling,
      balanceFailure: outcome.balanceFailure,
      ...marker,
    }));
  for (const finish of finishes) await appendLedgerEntry(files.ledger, finish);

  const empty = finishes.find((finish) => finish.balanceFailure !== null);
  if (empty === undefined) return { finishes, stopped: null };
  await writeFile(files.stopBalance, stopText(empty), "utf8");
  return { finishes, stopped: files.stopBalance };
}

/** @param {import("./ledger.mjs").FinishEntry} finish */
function stopText(finish) {
  const failure = finish.balanceFailure;
  const where = [failure.provider, failure.model].filter(Boolean).join("/") || "the provider";
  const status = failure.httpStatus === null ? "" : `, HTTP ${failure.httpStatus}`;
  const when = failure.at === null ? "" : `, at ${failure.at}`;
  return [
    `Run ${finish.runId} (instance ${finish.instance}, ${finish.task}) ended on an empty balance or exhausted quota at ${where}: ${failure.evidence}${status}${when}.`,
    "",
    "While this file exists the Lab refuses every live run, before any model call.",
    "To resume: top up the provider account, then delete this file by hand.",
    "Only a person removes it. An agent must not delete, move or rename it.",
    `Written ${finish.at}.`,
    "",
  ].join("\n");
}
