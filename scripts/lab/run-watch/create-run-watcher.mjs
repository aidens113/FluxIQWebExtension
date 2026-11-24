// Watches one run's `steps/` folder: reads each step as it finishes, feeds it
// to the rolling counts, appends an alert line to `watch-alerts.ndjson` only
// when a pattern holds, and rewrites the `watch-status.json` heartbeat no more
// often than `heartbeatMs`. It uses no model and only observes: the run is
// never stopped, slowed or reset from here.

import { appendFile, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { WATCH_THRESHOLDS } from "./config.mjs";
import { createWatchState } from "./create-watch-state.mjs";
import { readStep } from "./read-step.mjs";

const STEP_FOLDER = /^\d{4,}-/u;
const ALERTS_FILE = "watch-alerts.ndjson";
const STATUS_FILE = "watch-status.json";

/**
 * @param {{
 *   stepsDirectory: string, evidenceDirectory: string, runId?: string,
 *   mirrorAlertFiles?: string[], thresholds?: typeof WATCH_THRESHOLDS,
 *   now?: () => number, print?: (line: string) => void,
 * }} options
 */
export function createRunWatcher(options) {
  const { stepsDirectory, evidenceDirectory, runId = path.basename(evidenceDirectory), mirrorAlertFiles = [], thresholds = WATCH_THRESHOLDS, now = Date.now, print = () => {} } = options;
  const state = createWatchState(thresholds);
  const alertsFile = path.join(evidenceDirectory, ALERTS_FILE);
  const processed = new Set();
  let lastHeartbeat = Number.NEGATIVE_INFINITY;
  const written = [];

  async function poll({ final = false } = {}) {
    let names;
    try {
      names = (await readdir(stepsDirectory, { withFileTypes: true })).filter((entry) => entry.isDirectory() && STEP_FOLDER.test(entry.name)).map((entry) => entry.name).sort();
    } catch (error) {
      if (error?.code === "ENOENT") return written.length;
      throw error;
    }
    const fresh = names.filter((name) => !processed.has(name));
    const events = [];
    for (const name of fresh) events.push(await readStep(stepsDirectory, name));
    for (let index = 0; index < fresh.length; index += 1) {
      const event = events[index];
      if (event === null) {
        // Still being written, unless a later step already finished (it never will) or the run is over.
        if (!final && !events.slice(index + 1).some((later) => later !== null)) break;
        processed.add(fresh[index]);
        continue;
      }
      processed.add(fresh[index]);
      for (const alert of state.observe(event)) await record(alert);
    }
    await heartbeat(final);
    return written.length;
  }

  async function record(alert) {
    const line = { at: new Date(now()).toISOString(), runId, pattern: alert.pattern, steps: [alert.fromStep, alert.toStep], counts: alert.counts, costUsd: alert.costUsd, message: alert.message };
    written.push(line);
    const text = `${JSON.stringify(line)}\n`;
    for (const file of [alertsFile, ...mirrorAlertFiles]) {
      await mkdir(path.dirname(file), { recursive: true });
      await appendFile(file, text);
    }
    print(`[watch] ${runId} ${alert.pattern}: ${alert.message} (steps ${alert.fromStep}-${alert.toStep}, $${alert.costUsd}) -> ${alertsFile}`);
  }

  async function heartbeat(final) {
    const at = now();
    if (!final && at - lastHeartbeat < thresholds.heartbeatMs) return;
    lastHeartbeat = at;
    await mkdir(evidenceDirectory, { recursive: true });
    await writeFile(path.join(evidenceDirectory, STATUS_FILE), `${JSON.stringify({ runId, updatedAt: new Date(at).toISOString(), finished: final, ...state.snapshot() }, null, 2)}\n`);
  }

  return { poll, finish: () => poll({ final: true }), alertsFile, alerts: () => written.slice(), snapshot: () => state.snapshot() };
}
