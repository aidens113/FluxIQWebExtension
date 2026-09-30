// Closes launches whose launcher died without writing a finish: a killed
// terminal, a crash, a machine that ran out of memory. Their runs still spent
// money, and still count as "the previous run" for the debug and unchanged
// rules, so they are found and recorded before the next admission.
//
// A start is abandoned when its process is gone, or when it is older than any
// live run lasts -- Windows reuses process ids, so a live pid alone does not
// prove the launch is still in flight.

import { closeLaunch } from "./close-launch.mjs";
import { readLedger } from "./ledger.mjs";

export const ABANDONED_AFTER_MS = 6 * 60 * 60 * 1000;

/**
 * @param {ReturnType<typeof import("./guard-files.mjs").guardFiles>} files
 * @param {{ now: number, isAlive: (pid: number) => boolean }} options
 * @returns {Promise<Array<Awaited<ReturnType<typeof closeLaunch>>>>}
 */
export async function reconcileLedger(files, { now, isAlive }) {
  const entries = await readLedger(files.ledger);
  const finished = new Set(entries.filter((entry) => entry.event === "finish").map((entry) => entry.launchId));
  const closed = [];
  for (const start of entries) {
    if (start.event !== "start" || finished.has(start.launchId)) continue;
    const abandoned = now - Date.parse(start.at) > ABANDONED_AFTER_MS || (start.pid !== process.pid && !isAlive(start.pid));
    if (!abandoned) continue;
    closed.push(await closeLaunch(files, start, await readLedger(files.ledger), { exitCode: null, now, reconciled: true }));
  }
  return closed;
}
