import { RunnerFailure } from "../../failure.js";

/** Implementation gate, not a caller setting. No trusted verification/promoter is wired yet. */
export function assertCreatedFlowVerificationReady(): void {
  throw new RunnerFailure("facility.contract", "Created-Flow qualification is unavailable: trusted execution, independent verification and original-project promotion are not wired.", { details: { code: "lab.candidate_verification_unavailable", stage: "before_provider", providerInvocation: "not_attempted_by_this_entry", priorProviderCost: "unknown" } });
}
