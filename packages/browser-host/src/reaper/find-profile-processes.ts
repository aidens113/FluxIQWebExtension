import { normalizePath } from "./normalize-path.js";
import type { BrowserProcessEntry } from "./process-entry.js";
import { userDataDirOf } from "./user-data-dir-of.js";

/**
 * Every process whose command line names `profileDir` as its `--user-data-dir`:
 * the browser and the children Chromium passes the directory on to. This is the
 * one owner of `--user-data-dir` matching; the test-runner's browser lookup
 * builds on it.
 */
export function findProfileProcesses(processes: readonly BrowserProcessEntry[], profileDir: string): BrowserProcessEntry[] {
  const wanted = normalizePath(profileDir);
  return processes.filter(entry => userDataDirOf(entry.commandLine) === wanted);
}
