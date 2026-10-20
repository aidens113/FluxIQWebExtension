import { readdir } from "node:fs/promises";
import path from "node:path";
import { countSteps, readRunEntry } from "../lab-runs/index.js";
import type { RunFolder } from "./types.js";

const DATE_FOLDER = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * The newest `limit` runs under the runs root (`<date>/run-*`) whose `steps/`
 * holds at least one step, newest first by `entry.json`'s start.
 */
export async function findRecentRuns(root: string, limit: number): Promise<RunFolder[]> {
  const runs: RunFolder[] = [];
  const dates = (await readdir(root, { withFileTypes: true })).filter(entry => entry.isDirectory() && DATE_FOLDER.test(entry.name));
  for (const date of dates) {
    const folders = (await readdir(path.join(root, date.name), { withFileTypes: true })).filter(entry => entry.isDirectory() && entry.name.startsWith("run-"));
    for (const folder of folders) {
      const directory = path.join(root, date.name, folder.name);
      if ((await countSteps(path.join(directory, "steps"))) === 0) continue;
      const entry = await readRunEntry(path.join(directory, "entry.json"));
      runs.push({
        directory,
        runId: folder.name,
        startedAt: entry?.startedAt ?? `${date.name}T00:00:00.000Z`,
        verdict: entry?.verdict ?? "unknown",
        task: entry?.task ?? "unknown",
        lane: entry?.lane ?? "unknown"
      });
    }
  }
  return runs.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt) || b.runId.localeCompare(a.runId)).slice(0, limit);
}
