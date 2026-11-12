import type { BrowserProcessEntry } from "./process-entry.js";

/** `pid parentPid commandLine` lines, as both listing commands print them; a line that does not read is left out. */
export function parseProcessTable(output: string): BrowserProcessEntry[] {
  const entries: BrowserProcessEntry[] = [];
  for (const line of output.split(/\r?\n/u)) {
    const match = /^\s*(\d+)\s+(\d+)\s+(.*)$/u.exec(line);
    if (match) entries.push({ pid: Number(match[1]), parentPid: Number(match[2]), commandLine: match[3] ?? "" });
  }
  return entries;
}
