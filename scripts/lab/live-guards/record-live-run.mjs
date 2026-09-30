// The two ledger writes around one admitted live run: the start, immediately
// before the runner is spawned, and the finish, once it has exited.

import { randomBytes } from "node:crypto";
import { closeLaunch } from "./close-launch.mjs";
import { appendLedgerEntry, readLedger } from "./ledger.mjs";

/**
 * @param {NonNullable<Awaited<ReturnType<typeof import("./admit-live-run.mjs").admitLiveRun>>>} admission
 * @param {{ now?: number, pid?: number }} [options]
 * @returns {Promise<import("./ledger.mjs").StartEntry>}
 */
export async function recordLiveRunStart(admission, { now = Date.now(), pid = process.pid } = {}) {
  const { launch } = admission;
  /** @type {import("./ledger.mjs").StartEntry} */
  const start = {
    event: "start",
    launchId: `launch-${now.toString(36)}-${randomBytes(4).toString("hex")}`,
    at: new Date(now).toISOString(),
    pid,
    instance: launch.instance,
    scenarioId: launch.scenarioId,
    task: launch.task,
    fingerprint: launch.fingerprint,
    repositoryRoot: launch.repositoryRoot,
    runsDirectory: launch.runsDirectory,
    overridden: admission.overridden,
  };
  await appendLedgerEntry(admission.files.ledger, start);
  return start;
}

/**
 * @param {NonNullable<Awaited<ReturnType<typeof import("./admit-live-run.mjs").admitLiveRun>>>} admission
 * @param {import("./ledger.mjs").StartEntry} start
 * @param {{ exitCode: number | null, now?: number }} options
 */
export async function recordLiveRunFinish(admission, start, { exitCode, now = Date.now() }) {
  return closeLaunch(admission.files, start, await readLedger(admission.files.ledger), { exitCode, now, reconciled: false });
}
