// `pnpm lab watch ...`: the command-line face of the run watcher. A replay
// reads a finished run's steps, prints each alert, then one summary line. A
// followed run is polled until the command is interrupted, then read once more.
// Returns the exit code; alerts never make it non-zero.

import path from "node:path";
import { WATCH_THRESHOLDS } from "./config.mjs";
import { createRunWatcher } from "./create-run-watcher.mjs";
import { parseWatchArguments } from "./parse-watch-arguments.mjs";
import { replaySteps } from "./replay-steps.mjs";

/**
 * @param {string[]} args the arguments after `watch`
 * @param {{ write?: (text: string) => void, signal?: AbortSignal }} [options]
 * @returns {Promise<number>}
 */
export async function runWatchCommand(args, options = {}) {
  const { write = (text) => process.stderr.write(text), signal } = options;
  const parsed = parseWatchArguments(args);
  if ("error" in parsed) {
    write(`[lab] ${parsed.error}\n`);
    return 1;
  }
  const stepsDirectory = path.resolve(parsed.stepsDirectory);
  const print = (line) => write(`${line}\n`);
  if (parsed.mode === "replay") {
    const { alerts, snapshot, alertsFile } = await replaySteps({ stepsDirectory, ...(parsed.evidenceDirectory ? { evidenceDirectory: path.resolve(parsed.evidenceDirectory) } : {}), print });
    write(`${JSON.stringify({ lab: "watch", mode: "replay", alerts: alerts.length, byPattern: countBy(alerts), alertsFile, ...snapshot })}\n`);
    return 0;
  }
  const watcher = createRunWatcher({ stepsDirectory, evidenceDirectory: path.resolve(parsed.evidenceDirectory ?? path.dirname(stepsDirectory)), print });
  while (signal?.aborted !== true) {
    await watcher.poll();
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, WATCH_THRESHOLDS.pollMs);
      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        resolve(undefined);
      }, { once: true });
    });
  }
  await watcher.finish();
  return 0;
}

function countBy(alerts) {
  const counts = {};
  for (const alert of alerts) counts[alert.pattern] = (counts[alert.pattern] ?? 0) + 1;
  return counts;
}
