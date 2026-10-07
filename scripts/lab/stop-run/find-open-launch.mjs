// Which launch `stop <instance>` means: the instance's most recent `start`
// entry that no `finish` entry closes. Pure: entries in, start out.

/**
 * @param {import("../live-guards/ledger.mjs").LedgerEntry[]} entries
 * @param {string} instance
 * @returns {import("../live-guards/ledger.mjs").StartEntry | null}
 */
export function findOpenLaunch(entries, instance) {
  const finished = new Set(entries.filter((entry) => entry.event === "finish").map((entry) => entry.launchId));
  let latest = null;
  for (const entry of entries) {
    if (entry.event !== "start" || entry.instance !== instance || finished.has(entry.launchId)) continue;
    if (latest === null || Date.parse(entry.at) >= Date.parse(latest.at)) latest = entry;
  }
  return latest;
}
