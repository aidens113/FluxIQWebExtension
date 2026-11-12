import type { ChildProcess } from "node:child_process";

/** The engine's termination, observed independently from the run's assertions. */
export function hostProofProcessExit(child: ChildProcess): Promise<{ code: number | null; signal: NodeJS.Signals | null; error?: Error }> {
  return new Promise((resolve) => {
    let error: Error | undefined;
    const exited = (code: number | null, signal: NodeJS.Signals | null): void => {
      child.off("exit", exited);
      child.off("error", failed);
      resolve({ code, signal, ...(error ? { error } : {}) });
    };
    const failed = (cause: Error): void => {
      error = cause;
      if (child.pid === undefined) exited(child.exitCode, child.signalCode);
    };
    child.once("exit", exited);
    child.on("error", failed);
    if (child.exitCode !== null || child.signalCode !== null) exited(child.exitCode, child.signalCode);
  });
}
