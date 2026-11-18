import type { HostedPkceAttemptView, HostedPkceStoredAttempt } from "../model";
import type { HostedPkceFailureCode } from "../failure-codes";

export function pkceAttemptView(attempt: HostedPkceStoredAttempt | null, failureCode?: HostedPkceFailureCode): HostedPkceAttemptView {
  if (!attempt) return Object.freeze({ phase: "idle", ...(failureCode ? { failureCode } : {}) });
  const phase = attempt.phase === "terminal" ? attempt.outcome : attempt.phase;
  const failure = failureCode ?? (attempt.phase === "terminal" ? attempt.failureCode : undefined);
  return Object.freeze({ phase, attemptId: attempt.attemptId, ...(failure ? { failureCode: failure } : {}) });
}
