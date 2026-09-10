import type { ExistingRunDetail } from "./existing-fluxiq-control.js";
import { RunnerFailure } from "./failure.js";

const issueCodeAllowlist = new Set([
  "runtime_patch.target_node_invalid",
  "runtime_patch.target_override_rejected",
  "runtime_patch.patch_count_invalid",
  "runtime_patch.side_effect_not_authorized",
  "runtime_patch.policy_rejected",
  "runtime_patch.preflight_rejected",
]);

export type SafeRuntimePatchDiagnostic = Readonly<{
  patchCategory: "action_sequence" | "wait_retry" | "target_override" | "recovery_subflow" | "reroute" | "response" | "unknown";
  preflightStatus: "passed" | "failed" | "unknown";
  issueCodes: readonly string[];
  adaptationCreated: boolean;
  changeProposalCreated: boolean;
}>;

/** True as soon as the bounded diagnosis+patch run is terminal, even without a proposal ID. */
export function explorationAdaptationRunIsComplete(run: ExistingRunDetail): boolean {
  return isTerminal(run.summary.status) && (run.interventions?.length ?? 0) >= 2;
}

/** Returns the only proposal identity without exposing provider output or target data. */
export function requireExactExplorationProposalIdentity(run: ExistingRunDetail): string {
  const adaptationIds = [...new Set(run.adaptationIds ?? [])];
  if (adaptationIds.length !== 1) {
    throw new RunnerFailure("runtime.behavior", "Exploration adaptation did not produce one exact proposal", {
      details: {
        reasonCode: "exploration_adaptation_run.proposal_identity_invalid",
        runtimePatchDiagnostics: safeRuntimePatchDiagnostics(run),
      },
    });
  }
  return adaptationIds[0]!;
}

export function safeRuntimePatchDiagnostics(run: ExistingRunDetail): readonly SafeRuntimePatchDiagnostic[] {
  return Object.freeze((run.runtimePatchAttempts ?? []).slice(0, 4).map(attempt => Object.freeze({
    patchCategory: patchCategory(attempt.kind),
    preflightStatus: attempt.preflightOk === true ? "passed" as const : attempt.preflightOk === false ? "failed" as const : "unknown" as const,
    issueCodes: Object.freeze([...new Set(attempt.issueCodes.map(code => issueCodeAllowlist.has(code)
      ? code : "runtime_patch.preflight_rejected"))].slice(0, 8)),
    adaptationCreated: attempt.adaptationCreated === true,
    changeProposalCreated: attempt.changeProposalCreated === true,
  })));
}

function patchCategory(kind: string | undefined): SafeRuntimePatchDiagnostic["patchCategory"] {
  if (kind === "temporary_action_sequence") return "action_sequence";
  if (kind === "temporary_wait_retry") return "wait_retry";
  if (kind === "temporary_target_override") return "target_override";
  if (kind === "temporary_recovery_subflow_call") return "recovery_subflow";
  if (kind === "temporary_reroute") return "reroute";
  if (kind === "runtime_patch_response") return "response";
  return "unknown";
}

function isTerminal(status: ExistingRunDetail["summary"]["status"]): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled";
}
