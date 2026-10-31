import { parseAutomationStudioFailureRecord, type AutomationStudioFailureRecord } from "fluxiq/automation-studio";

/** Host boundary: a valid original outranks a code-derived reconstruction. */
export function readWebHostFailure(value: unknown): AutomationStudioFailureRecord | undefined {
  return parseAutomationStudioFailureRecord(value) ?? undefined;
}
