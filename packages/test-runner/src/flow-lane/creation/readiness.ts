// Whether a created-Flow run may build at all, decided by the authoring mode
// the run's Core was started in (`../../live-llm/authoring-mode-env.ts`, Core's
// `FLUXIQ_AUTHORING_MODE`).
//
// In `legacy` mode Core proposes an adaptation that the lane applies, runs and
// judges, as at the baseline (downstream `92d790d7`, Core `e9b7d691`). In
// `candidate` mode Core only saves an unverified candidate draft, and nothing
// yet executes, verifies or promotes one, so qualification is refused before
// any provider call. Only Core's exact `legacy` admits: a caller's verdict, a
// model's answer or any other value refuses.

import type { AutomationStudioAuthoringMode } from "fluxiq/automation-studio";
import { RunnerFailure } from "../../failure.js";

/** Whether a run whose Core authors in `authoringMode` may build a Flow to qualify. */
export function createdFlowVerificationReady(authoringMode: AutomationStudioAuthoringMode): boolean {
  return authoringMode === "legacy";
}

/** Refuses, before any provider call, a run whose Core cannot produce a Flow the lane may run. */
export function assertCreatedFlowVerificationReady(authoringMode: AutomationStudioAuthoringMode): void {
  if (createdFlowVerificationReady(authoringMode)) return;
  throw new RunnerFailure("facility.contract", "Created-Flow qualification is unavailable in candidate authoring mode: trusted execution, independent verification and original-project promotion are not wired.", { details: { code: "lab.candidate_verification_unavailable", stage: "before_provider", authoringMode: typeof authoringMode === "string" ? authoringMode : "unrecognized", providerInvocation: "not_attempted_by_this_entry", priorProviderCost: "unknown" } });
}
