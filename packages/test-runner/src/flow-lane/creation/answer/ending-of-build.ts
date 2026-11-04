import type { AttemptEndingFact } from "./ports.js";

/**
 * How a build ended, from Core's failure code, until Core's attempt record says it
 * outright (`AutomationStudioTaskAttempt.status`). A spent budget has a code of its own
 * (`flow_bootstrap.evidence_budget_exhausted`), and a person's Stop is a cancellation.
 * Any other failure is `other`, which the hard rule fails when it left no result.
 */
export function attemptEndingOfBuild(failureCode: string | null | undefined): AttemptEndingFact {
  if (!failureCode) return "finished";
  if (/budget_exhausted/u.test(failureCode)) return "budget_out";
  if (/cancel/u.test(failureCode)) return "stopped_by_person";
  return "other";
}
