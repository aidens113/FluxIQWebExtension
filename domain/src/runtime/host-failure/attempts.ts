import { projectAutomationStudioFailureControlRecord, type AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { readWebHostFailure } from "./read";
import { webHostFailure } from "./annotate";

/** A selected refusal is not proof about earlier dispatches in this call. */
export function webHostAttemptFailure(
  answers: readonly { status: string; failure?: unknown }[],
  selected: { status: string; failure?: unknown },
  lastingAct: "landed" | "uncertain" | undefined
): AutomationStudioFailureRecord | undefined {
  if (selected.status === "succeeded" || lastingAct === "landed") return undefined;
  const failure = webHostFailure(selected.failure);
  if (failure?.transient !== true || failure.effect !== "unacted") return projectAutomationStudioFailureControlRecord(failure);
  const originals = answers.map((answer) => answer.status === "failed" ? readWebHostFailure(answer.failure) : undefined);
  if (lastingAct === undefined && originals.length > 0 && originals.every((original) => original?.effect === "unacted" && original.retryable)) return projectAutomationStudioFailureControlRecord(failure);
  // Preserve stronger original control facts; missing history grants nothing.
  const stronger = originals.find((original) => original !== undefined && (original.effect !== "unacted" || !original.retryable));
  return stronger === undefined ? undefined : projectAutomationStudioFailureControlRecord(webHostFailure(stronger));
}
