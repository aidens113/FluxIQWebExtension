/** One process as the helper's `processes` command lists it. */
export type BrowserProcessEntry = { pid: number; parentPid: number; commandLine: string };

const USER_DATA_DIR = "--user-data-dir=";

/**
 * The browser process a run launched, found by the profile directory it was
 * launched on.
 *
 * Every Lab run's persistent context owns its own profile directory
 * (`topology.allocation.browserProfileDir`), so that directory names this run's
 * Chromium among every other lane's. Chromium passes `--user-data-dir` on to its
 * child processes too, and those own no window; the browser process is the one
 * without `--type=`. When more than one such process names the directory, the
 * one whose parent is not among them is the root.
 *
 * Paths compare case-insensitively with either separator and no trailing
 * separator, because Windows accepts all of those spellings for one directory.
 */
export function findBrowserProcess(processes: readonly BrowserProcessEntry[], profileDir: string): number | undefined {
  const wanted = normalizePath(profileDir);
  const browsers = processes.filter(entry => !/(?:^|\s|")--type=/u.test(entry.commandLine) && userDataDirOf(entry.commandLine) === wanted);
  const pids = new Set(browsers.map(entry => entry.pid));
  return (browsers.find(entry => !pids.has(entry.parentPid)) ?? browsers[0])?.pid;
}

/** The normalized `--user-data-dir` value of one command line, in any of the three quotings Windows produces. */
function userDataDirOf(commandLine: string): string | undefined {
  const at = commandLine.indexOf(USER_DATA_DIR);
  if (at < 0) return undefined;
  const start = at + USER_DATA_DIR.length;
  // `--user-data-dir="C:\a b"`, `"--user-data-dir=C:\a b"`, or `--user-data-dir=C:\a`.
  const valueQuoted = commandLine[start] === "\"";
  const argumentQuoted = at > 0 && commandLine[at - 1] === "\"";
  const from = valueQuoted ? start + 1 : start;
  const end = valueQuoted || argumentQuoted ? commandLine.indexOf("\"", from) : commandLine.slice(from).search(/\s/u) + from;
  const value = end < from ? commandLine.slice(from) : commandLine.slice(from, end);
  return normalizePath(value);
}

function normalizePath(value: string): string {
  return value.trim().replace(/\//gu, "\\").replace(/\\+$/u, "").toLowerCase();
}
