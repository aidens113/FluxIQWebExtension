// The questions the rules ask of the ledger. Pure: entries in, answer out.

/** @typedef {import("./ledger.mjs").LedgerEntry} LedgerEntry */

/**
 * The live spend recorded since `sinceMs`: the sum of every finish entry's
 * `totalEstimatedCostUsd` at or after it. A run whose cost was not recorded
 * adds nothing, and is counted in `unknown` so a reader can see it.
 *
 * @param {LedgerEntry[]} entries
 * @param {number} sinceMs
 * @returns {{ usd: number, runs: number, unknown: number }}
 */
export function windowSpend(entries, sinceMs) {
  let cents = 0;
  let runs = 0;
  let unknown = 0;
  for (const entry of entries) {
    if (entry.event !== "finish" || Date.parse(entry.at) < sinceMs) continue;
    runs += 1;
    const cost = entry.totalEstimatedCostUsd;
    if (typeof cost === "number" && Number.isFinite(cost) && cost >= 0) cents += cost * 1e6;
    else unknown += 1;
  }
  // Summed in micro-dollars so ten runs of $0.1 total $1, not $0.9999999999999999.
  return { usd: Math.round(cents) / 1e6, runs, unknown };
}

/**
 * The most recent finish entry that names a run and matches `accept`.
 * Finishes with no runId -- a launch that never produced a run -- spent
 * nothing and taught nothing, so they are not "the previous run".
 *
 * @param {LedgerEntry[]} entries
 * @param {(entry: import("./ledger.mjs").FinishEntry) => boolean} accept
 * @returns {import("./ledger.mjs").FinishEntry | null}
 */
export function previousRun(entries, accept) {
  let latest = null;
  for (const entry of entries) {
    if (entry.event !== "finish" || typeof entry.runId !== "string" || !accept(entry)) continue;
    if (latest === null || Date.parse(entry.at) >= Date.parse(latest.at)) latest = entry;
  }
  return latest;
}

/**
 * The start entries `instance` wrote at or after `sinceMs`.
 *
 * @param {LedgerEntry[]} entries
 * @param {string} instance
 * @param {number} sinceMs
 */
export function recentStarts(entries, instance, sinceMs) {
  return entries.filter((entry) => entry.event === "start" && entry.instance === instance && Date.parse(entry.at) >= sinceMs);
}
