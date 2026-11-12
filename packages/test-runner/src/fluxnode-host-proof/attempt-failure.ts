import type { ScriptedModelCall } from "../attempt-lane/scripted-model/index.js";

/** Explains one attempt's failed result using the provider requests observed by this proof. */
export function hostProofAttemptFailure(input: {
  name: string; ordinal: number; status: string; runId: string;
  calls: readonly ScriptedModelCall[]; diagnosticFailure?: ScriptedModelCall | undefined;
}): { code: "script_refusal" | "diagnostic_cancelled" | "unexpected_result"; message: string } {
  const prefix = `Host attempt ${input.name}/${input.ordinal} ended ${input.status} without the exact requested rows`;
  const refused = input.calls.find((call) => !call.answered && call.correlationId === input.runId);
  if (refused) return { code: "script_refusal", message: `${prefix}; its own ${refused.kind} request ${refused.ordinal} was refused.` };
  const cause = input.diagnosticFailure;
  if (input.status === "stopped" && cause) {
    const owner = cause.correlationId ? `${cause.correlationId}'s` : "an unattributed";
    return { code: "diagnostic_cancelled", message: `${prefix}; the diagnostic was cancelled by ${owner} ${cause.kind} request ${cause.ordinal}.` };
  }
  return { code: "unexpected_result", message: `${prefix}.` };
}
