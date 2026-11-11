import { execFile } from "node:child_process";
import { parseProcessTable } from "./parse-process-table.js";
import type { BrowserProcessEntry } from "./process-entry.js";

const WINDOWS_LISTING = "Get-CimInstance Win32_Process | ForEach-Object { '{0} {1} {2}' -f $_.ProcessId, $_.ParentProcessId, $_.CommandLine }";

/** Every running process with its full command line: `Get-CimInstance Win32_Process` on Windows, `ps -ax` elsewhere. */
export function listProcesses(): Promise<BrowserProcessEntry[]> {
  const [command, args] = process.platform === "win32"
    ? ["powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", WINDOWS_LISTING]] as const
    : ["ps", ["-ax", "-o", "pid=,ppid=,args="]] as const;
  return new Promise((resolve, reject) => {
    execFile(command, [...args], { windowsHide: true, maxBuffer: 64 * 1024 * 1024 }, (error, stdout) => (error ? reject(error) : resolve(parseProcessTable(stdout))));
  });
}
