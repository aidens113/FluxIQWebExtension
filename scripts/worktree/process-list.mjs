// Every running process's id, parent, name and command line, as the operating
// system reports them. A listing that cannot be read is an error, never an
// empty list: an empty list would read as "nothing is running in this worktree".

import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { parseProcessListingJson } from "./process-listing-json.mjs";

const execFileAsync = promisify(execFile);
const WINDOWS_QUERY = "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Compress";
const MAX_BUFFER = 64 * 1024 * 1024;

/** @returns {Promise<Array<{ pid: number, parentPid: number | null, name: string, commandLine: string }>>} */
export async function listProcesses() {
  if (process.platform === "win32") {
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", WINDOWS_QUERY], { windowsHide: true, encoding: "utf8", maxBuffer: MAX_BUFFER });
    const rows = parseProcessListingJson(stdout);
    return (Array.isArray(rows) ? rows : [rows]).map((row) => ({
      pid: Number(row.ProcessId),
      parentPid: row.ParentProcessId === null || row.ParentProcessId === undefined ? null : Number(row.ParentProcessId),
      name: String(row.Name ?? ""),
      commandLine: String(row.CommandLine ?? ""),
    }));
  }
  const { stdout } = await execFileAsync("ps", ["-Ao", "pid=,ppid=,args="], { encoding: "utf8", maxBuffer: MAX_BUFFER });
  return stdout.split("\n").flatMap((line) => {
    const match = /^\s*(\d+)\s+(\d+)\s+(.*)$/u.exec(line);
    if (!match) return [];
    const commandLine = match[3].trim();
    return [{ pid: Number(match[1]), parentPid: Number(match[2]), name: path.basename(commandLine.split(/\s+/u)[0] ?? ""), commandLine }];
  });
}
