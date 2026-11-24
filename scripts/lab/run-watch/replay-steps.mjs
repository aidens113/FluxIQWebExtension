// Replays finished step folders through the watcher, for proving the patterns
// on a recorded run: `pnpm lab watch --from-steps <steps dir>`. The recorded
// run is only read. Its alerts go to `evidenceDirectory`, a fresh temporary
// folder unless one is given, so a replay never writes into a run's own files.

import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRunWatcher } from "./create-run-watcher.mjs";

/** @param {{ stepsDirectory: string, evidenceDirectory?: string, print?: (line: string) => void, thresholds?: Parameters<typeof createRunWatcher>[0]["thresholds"] }} options */
export async function replaySteps({ stepsDirectory, evidenceDirectory, print, thresholds }) {
  const evidence = evidenceDirectory ?? await mkdtemp(path.join(os.tmpdir(), "lab-watch-replay-"));
  const runId = path.basename(path.dirname(path.resolve(stepsDirectory)));
  const watcher = createRunWatcher({ stepsDirectory, evidenceDirectory: evidence, runId, ...(print ? { print } : {}), ...(thresholds ? { thresholds } : {}) });
  await watcher.finish();
  return { alerts: watcher.alerts(), snapshot: watcher.snapshot(), alertsFile: watcher.alertsFile };
}
