/**
 * Whether a process with this id exists. Signal 0 tests existence without
 * signalling, on Windows as elsewhere; `EPERM` means it exists and belongs to
 * someone else. A pid the operating system has since reused reads as alive,
 * which leaves a crashed run reading "running" until that process ends too.
 */
export function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}
