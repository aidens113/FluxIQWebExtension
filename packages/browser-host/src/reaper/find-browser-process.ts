import { findProfileProcesses } from "./find-profile-processes.js";
import type { BrowserProcessEntry } from "./process-entry.js";

/**
 * The browser process launched on a profile directory. Chromium passes
 * `--user-data-dir` on to its child processes too, and those own no window; the
 * browser process is the one without `--type=`. When more than one such process
 * names the directory, the one whose parent is not among them is the root.
 */
export function findBrowserProcess(processes: readonly BrowserProcessEntry[], profileDir: string): number | undefined {
  const browsers = findProfileProcesses(processes, profileDir).filter(entry => !/(?:^|\s|")--type=/u.test(entry.commandLine));
  const pids = new Set(browsers.map(entry => entry.pid));
  return (browsers.find(entry => !pids.has(entry.parentPid)) ?? browsers[0])?.pid;
}
