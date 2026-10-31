import type { AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_FAILURE_CODES } from "../failure";
import { webHostFailure } from "./annotate";

/** Preserve an attached original at host-only throw boundaries without running getters. */
export function webHostThrownFailure(error: unknown): AutomationStudioFailureRecord | undefined {
  if (error === null || typeof error !== "object") return undefined;
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(error, "failure");
  } catch {
    return unreadableThrownFailure();
  }
  return descriptor && "value" in descriptor ? webHostFailure(descriptor.value) : undefined;
}

/** An unreadable carrier proves neither nonexecution nor safe repetition. */
function unreadableThrownFailure(): AutomationStudioFailureRecord {
  return {
    category: "ambiguous_or_unknown",
    code: WEB_AUTOMATION_FAILURE_CODES.UNKNOWN,
    retryable: false,
    stage: "execution",
    effect: "ambiguous"
  };
}
