import type { BrowserProcessEntry } from "./find-browser-process.js";

/**
 * The helper's `processes` output -- one `pid TAB parentPid TAB commandLine`
 * line per process -- as entries. A line that does not parse is left out
 * rather than guessed at; it cannot be the run's browser if its id is unreadable.
 */
export function parseProcessList(output: string): BrowserProcessEntry[] {
  const entries: BrowserProcessEntry[] = [];
  for (const line of output.split(/\r?\n/u)) {
    const [pidText, parentText, ...rest] = line.split("\t");
    const pid = Number(pidText);
    const parentPid = Number(parentText);
    if (!pidText || !Number.isInteger(pid) || pid <= 0 || !Number.isInteger(parentPid)) continue;
    entries.push({ pid, parentPid, commandLine: rest.join("\t") });
  }
  return entries;
}
