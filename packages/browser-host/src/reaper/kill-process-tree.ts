import { execFile } from "node:child_process";

/**
 * Ends one process and its descendants: `taskkill /PID <pid> /T /F` on Windows;
 * elsewhere a signal to the process (`SIGTERM`, or `SIGKILL` when `force`), its
 * children being named by the same profile directory and found by the caller.
 * A process that is already gone is not an error.
 */
export function killProcessTree(pid: number, force: boolean): Promise<void> {
  if (process.platform !== "win32") {
    try {
      process.kill(pid, force ? "SIGKILL" : "SIGTERM");
    } catch {
      /* best-effort: the process is already gone */
    }
    return Promise.resolve();
  }
  return new Promise(resolve => {
    execFile("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true }, () => resolve());
  });
}
