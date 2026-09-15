export type PidPresence = "present" | "absent" | "unknown";

type SignalZero = (pid: number, signal: 0) => unknown;

const sendSignalZero: SignalZero = (pid, signal) => process.kill(pid, signal);

/**
 * Reports whether any process currently holds `pid`, without spawning a
 * process to find out. Signal 0 delivers nothing. Success means a process
 * holds the PID; EPERM means one does but this process may not signal it
 * (Windows reports this for System, PID 4); ESRCH means none does (Windows
 * reports this for an exited child and for a PID that was never allocated).
 * Any other failure, such as a PID Node refuses to pass to the operating
 * system, is not evidence either way.
 *
 * This answers "does some process hold this PID", never "is it still the
 * owner": a reused PID is present too, so identity stays with the full probe.
 */
export function pidPresence(pid: number, signal: SignalZero = sendSignalZero): PidPresence {
  try {
    signal(pid, 0);
    return "present";
  } catch (error) {
    const code = error !== null && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code === "ESRCH") return "absent";
    if (code === "EPERM") return "present";
    return "unknown";
  }
}
