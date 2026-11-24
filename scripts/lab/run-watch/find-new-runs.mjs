// Finds the run folders a launch created, in the machine-wide `lab-runs/`
// (`<local date>/<runId>/`, opened by the runner before Core starts). A run is
// this launch's when its `entry.json` names the launched process, or, if the
// entry names no process, when it started after the launch did.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const DATE_FOLDER = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * @param {string} runsRoot the `lab-runs/` folder
 * @param {{ sinceMs: number, pid?: number | null, instance?: string | null }} launch
 * @returns {Promise<{ runId: string, evidenceDirectory: string, stepsDirectory: string }[]>}
 */
export async function findNewRuns(runsRoot, { sinceMs, pid = null, instance = null }) {
  const found = [];
  for (const date of await names(runsRoot)) {
    if (!DATE_FOLDER.test(date)) continue;
    for (const runId of await names(path.join(runsRoot, date))) {
      const evidenceDirectory = path.join(runsRoot, date, runId);
      const entry = await readEntry(path.join(evidenceDirectory, "entry.json"));
      if (entry === null) continue;
      const startedMs = Date.parse(entry.startedAt);
      if (!Number.isFinite(startedMs) || startedMs < sinceMs - 2_000) continue;
      const ours = Number.isInteger(entry.pid) ? entry.pid === pid || (instance !== null && entry.instance === instance) : true;
      if (ours) found.push({ runId, evidenceDirectory, stepsDirectory: path.join(evidenceDirectory, "steps") });
    }
  }
  return found;
}

async function names(directory) {
  try { return (await readdir(directory, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(); } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function readEntry(file) {
  try {
    const entry = JSON.parse(await readFile(file, "utf8"));
    return entry !== null && typeof entry === "object" ? entry : null;
  } catch (error) {
    // No entry yet, or one still being written: the run is picked up on a later look.
    if (error?.code === "ENOENT" || error instanceof SyntaxError) return null;
    throw error;
  }
}
