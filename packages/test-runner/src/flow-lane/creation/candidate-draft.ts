import { parseAutomationStudioCandidateAuthoringResult, type AutomationStudioCandidateAuthoringResult } from "fluxiq/automation-studio";

/** Screen the actual draft response; its fields are not execution or promotion receipts. */
export function createdFlowCandidateDraft(payload: unknown, subject: { projectId: string; flowId: string }): AutomationStudioCandidateAuthoringResult | null {
  return parseAutomationStudioCandidateAuthoringResult(payload, subject);
}
