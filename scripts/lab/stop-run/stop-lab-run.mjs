// Stops one Lab run: the instance's open launch in the spend ledger, by the
// pid that launch recorded, and its process tree only. Then, once the process
// is gone, the ledger reconciliation closes the launch exactly as the next
// admission would have (`"reconciled": true`, its runs and their spend).
//
// It refuses, killing nothing, when the instance has no open launch, when the
// recorded process is no longer running, or when the start is older than any
// live run lasts: Windows reuses process ids, so an old pid may now belong to
// another program.

import { isProcessAlive } from "../../build-cache/index.mjs";
import { ABANDONED_AFTER_MS, DEFAULT_LAB_SLOTS_DIRECTORY, guardFiles, readLedger, reconcileLedger } from "../live-guards/index.mjs";
import { findOpenLaunch } from "./find-open-launch.mjs";
import { killProcessTree } from "./kill-process-tree.mjs";

const EXIT_POLL_MS = 250;
const EXIT_TIMEOUT_MS = 10_000;

/**
 * @param {{
 *   instance: string, slotsDirectory?: string, now?: number,
 *   isAlive?: (pid: number) => boolean,
 *   killTree?: (pid: number) => Promise<{ ok: boolean, detail: string }>,
 *   sleep?: (ms: number) => Promise<void>,
 * }} options
 * @returns {Promise<{ status: "stopped" | "refused" | "failed", message: string, launch: import("../live-guards/ledger.mjs").StartEntry | null, finishes: import("../live-guards/ledger.mjs").FinishEntry[] }>}
 */
export async function stopLabRun(options) {
  const { instance, slotsDirectory = DEFAULT_LAB_SLOTS_DIRECTORY, now = Date.now(), isAlive = isProcessAlive, killTree = killProcessTree, sleep = delay } = options;
  const files = guardFiles(slotsDirectory);
  const launch = findOpenLaunch(await readLedger(files.ledger), instance);
  const end = (status, message) => ({ status, message, launch, finishes: [] });
  if (launch === null) return end("refused", `no open live run for instance ${instance} in ${files.ledger}: it has no start without a finish, so there is nothing to stop`);
  const what = `instance ${instance}'s launch ${launch.launchId} (${launch.task}, started ${launch.at}, process ${launch.pid})`;
  if (now - Date.parse(launch.at) > ABANDONED_AFTER_MS) {
    return end("refused", `${what} is older than ${ABANDONED_AFTER_MS / 3_600_000} hours, longer than any live run lasts; its process id may now belong to another program, so nothing is killed. The next live admission reconciles it`);
  }
  if (launch.pid === process.pid) return end("refused", `${what} recorded this process's own id; nothing is killed`);
  if (!isAlive(launch.pid)) return end("refused", `process ${launch.pid} is no longer running, so ${what} has nothing to stop. The next live admission reconciles it`);

  const killed = await killTree(launch.pid);
  if (!killed.ok) return end("failed", `could not kill ${what}: ${killed.detail}`);
  for (let waited = 0; isAlive(launch.pid) && waited < EXIT_TIMEOUT_MS; waited += EXIT_POLL_MS) await sleep(EXIT_POLL_MS);
  if (isAlive(launch.pid)) return end("failed", `killed ${what}, but process ${launch.pid} is still running after ${EXIT_TIMEOUT_MS / 1000}s; the launch is left open`);

  const closed = await reconcileLedger(files, { now, isAlive });
  const finishes = closed.flatMap((each) => each.finishes).filter((finish) => finish.launchId === launch.launchId);
  return { status: "stopped", message: `stopped ${what} and its process tree; the ledger recorded ${finishes.length} finish entr${finishes.length === 1 ? "y" : "ies"} for it`, launch, finishes };
}

/** @param {number} ms */
function delay(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}
