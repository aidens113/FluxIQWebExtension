// The watcher beside one Lab launch (`pnpm lab attempt|run`, live or
// provider-free). The launcher does not know the run's id until the runner has
// opened it, so this finds the launch's run folders as they appear, watches
// each with its own rolling counts (one attempt each), and also mirrors every
// alert into one file whose path is known up front: the launching agent waits
// on that file, for example with Claude Code's Monitor tool and
// `until grep -q . <file>`, instead of polling the logs.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { WATCH_THRESHOLDS } from "./config.mjs";
import { createRunWatcher } from "./create-run-watcher.mjs";
import { findNewRuns } from "./find-new-runs.mjs";

/**
 * @param {{
 *   runsRoot: string, launchDirectory: string, instance?: string | null, thresholds?: typeof WATCH_THRESHOLDS,
 *   print?: (line: string) => void, now?: () => number,
 * }} options
 */
export async function startLabWatcher({ runsRoot, launchDirectory, instance = null, thresholds = WATCH_THRESHOLDS, print = () => {}, now = Date.now }) {
  const sinceMs = now();
  const launchAlertsFile = path.join(launchDirectory, "watch-alerts.ndjson");
  await mkdir(launchDirectory, { recursive: true });
  await writeFile(launchAlertsFile, "", { flag: "a" });
  print(`[watch] alerts for this launch: ${launchAlertsFile} (empty until a run repeats itself or stops progressing; wait on it with a Monitor and: until grep -q . "${launchAlertsFile}")`);

  /** @type {Map<string, ReturnType<typeof createRunWatcher>>} */
  const watchers = new Map();
  let pid = null;
  let timer = null;
  let busy = Promise.resolve();

  async function tick(final) {
    for (const run of await findNewRuns(runsRoot, { sinceMs, pid, instance })) {
      if (watchers.has(run.runId)) continue;
      watchers.set(run.runId, createRunWatcher({ ...run, mirrorAlertFiles: [launchAlertsFile], thresholds, now, print }));
      print(`[watch] watching ${run.runId}; its alerts also go to ${path.join(run.evidenceDirectory, "watch-alerts.ndjson")}`);
    }
    for (const watcher of watchers.values()) await (final ? watcher.finish() : watcher.poll());
  }
  const schedule = () => {
    timer = setTimeout(() => {
      busy = tick(false)
        .catch((error) => print(`[watch] could not read a step log: ${error instanceof Error ? error.message : String(error)}`))
        .finally(() => { if (timer !== null) schedule(); });
    }, thresholds.pollMs);
    timer.unref?.();
  };
  schedule();

  return {
    launchAlertsFile,
    /** The launched process, which a run's entry names. */
    setPid(value) { pid = value; },
    /** Reads what is left once the run has ended, then stops. */
    async stop() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      await busy;
      await tick(true);
      return [...watchers.values()].flatMap((watcher) => watcher.alerts());
    },
  };
}
