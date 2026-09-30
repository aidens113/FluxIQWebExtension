// Turning the status stream into problem-log entries.
//
// The connection publishes its status on every change, and most changes are not
// failures. This notes the two that are, each once when it first appears: a new
// `lastError` (a socket that failed, a refused pairing), and a runtime command
// that ended `failed`. The same error published again by the next status is not
// a new failure, and an error that clears and comes back is.

import type { ExtensionStatus } from "../../../shared/protocol";
import type { ProblemLogInput } from "./log";

export type ProblemNoticerStatus = Pick<ExtensionStatus, "lastError" | "runtime">;

export class ProblemNoticer {
  private lastError: string | undefined;
  private lastFailedCommand: string | undefined;

  constructor(private readonly note: (input: ProblemLogInput) => unknown) {}

  observe(status: ProblemNoticerStatus): void {
    if (status.lastError !== this.lastError) {
      this.lastError = status.lastError;
      if (status.lastError) this.note({ source: "connection", message: status.lastError });
    }
    const runtime = status.runtime;
    if (runtime?.state === "failed") {
      const key = `${runtime.commandId ?? ""}:${runtime.finishedAt ?? ""}`;
      if (key !== this.lastFailedCommand) {
        this.lastFailedCommand = key;
        this.note({ source: "action", message: runtime.error ?? runtime.message ?? "A browser action failed.", commandId: runtime.commandId });
      }
    }
  }
}
