import { readdir } from "node:fs/promises";
import path from "node:path";
import { countSteps } from "./count-steps.js";
import { withDirectoryLock, type DirectoryLockOptions } from "./directory-lock.js";
import { isProcessAlive } from "./is-process-alive.js";
import { localDateTime } from "./local-time.js";
import { renderRunsIndex, type RunsIndexRow } from "./render-runs-index.js";
import { readRunEntry } from "./run-entry.js";
import { writeFileAtomically } from "./write-atomically.js";

export type RegenerateRunsIndexOptions = {
  /** Whether a run's Lab process still exists; a test injects its own. */
  isAlive?: (pid: number) => boolean;
  log?: (line: string) => void;
  lock?: Omit<DirectoryLockOptions, "log">;
};

const DATE_FOLDER = /^\d{4}-\d{2}-\d{2}$/u;

/**
 * Rebuilds `<root>/index.md` from every `<root>/<date>/<runId>/entry.json`.
 * Four lanes start and end runs at once, so the read and the write happen
 * under `<root>/.index.lock`: whichever regeneration holds it last read every
 * entry written before it, so no run's row is lost to another's rename. The
 * file is replaced by a temporary file and a rename. An entry that cannot be
 * read is left out and named on the log, never fatal.
 */
export async function regenerateRunsIndex(root: string, options: RegenerateRunsIndexOptions = {}): Promise<void> {
  const log = options.log ?? (line => process.stderr.write(`${line}\n`));
  await withDirectoryLock(path.join(root, ".index.lock"), async () => {
    const rows = await readRows(root, options.isAlive ?? isProcessAlive, log);
    await writeFileAtomically(path.join(root, "index.md"), renderRunsIndex(rows));
  }, { ...options.lock, log });
}

async function readRows(root: string, isAlive: (pid: number) => boolean, log: (line: string) => void): Promise<RunsIndexRow[]> {
  const rows: RunsIndexRow[] = [];
  for (const date of await readdir(root, { withFileTypes: true })) {
    if (!date.isDirectory() || !DATE_FOLDER.test(date.name)) continue;
    for (const run of await readdir(path.join(root, date.name), { withFileTypes: true })) {
      if (!run.isDirectory()) continue;
      const folder = path.join(root, date.name, run.name);
      try {
        const entry = await readRunEntry(path.join(folder, "entry.json"));
        if (!entry) continue;
        const started = new Date(entry.startedAt);
        const { date: day, time } = localDateTime(started);
        rows.push({
          folder: `${date.name}/${run.name}/`, started: Number.isNaN(started.getTime()) ? entry.startedAt : `${day} ${time}`, startedAt: entry.startedAt,
          lane: entry.lane ?? "default", task: entry.task ?? entry.scenarioId ?? "unknown", verdict: entry.verdict === "running" && !isAlive(entry.pid) ? "unfinished" : entry.verdict,
          costUsd: typeof entry.costUsd === "number" ? entry.costUsd : null, steps: await countSteps(path.join(folder, "steps")),
        });
      } catch (error) {
        log(`[lab runs] ${folder} is left out of the index: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  return rows;
}
