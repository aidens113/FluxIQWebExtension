import { pkceAttemptView } from "./attempt";
import { pkceFailureCode } from "./context";
import type { HostedPkceStoredAttempt, HostedPkceAttemptView } from "./model";

export function failedPkceOperation(error: unknown, record?: HostedPkceStoredAttempt): HostedPkceAttemptView {
  const code = pkceFailureCode(error);
  return Object.freeze({ ...pkceAttemptView(record ?? null), phase: code === "cancelled" ? "cancelled" : "failed", failureCode: code });
}
