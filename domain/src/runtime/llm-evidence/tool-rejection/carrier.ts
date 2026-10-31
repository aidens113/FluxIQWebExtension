import { projectAutomationStudioFailureControlRecord, type AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { parseAutomationStudioTargetActionabilityRecord, type AutomationStudioTargetActionabilityRecord } from "fluxiq/automation-studio/actionability";
import type { WebLlmSnapshotBinding } from "../sanitize";
import type { WebLlmToolRejectionCode, WebLlmToolRejectionDetail } from "../tool-rejection";

/** A refusal carries only projected controls before a catch can observe it. */
export class RecoverableToolRejection extends Error {
  readonly failure?: AutomationStudioFailureRecord;
  readonly actionability?: AutomationStudioTargetActionabilityRecord;
  /**
   * `page` is set only for a refusal the page caused, and only when the page could be captured.
   *
   * `personNeeded` is set only when the page answered `USER_INTERVENTION_REQUIRED`:
   * a robot check stood in the way and nothing was done about it. Such a refusal
   * is not for the model -- the call's result says `personNeeded` and Core puts
   * the check to the person (`../node-run/run.ts`).
   */
  constructor(
    readonly code: WebLlmToolRejectionCode,
    readonly detail?: WebLlmToolRejectionDetail,
    readonly page?: WebLlmSnapshotBinding,
    readonly personNeeded?: true,
    failure?: unknown,
    actionability?: unknown
  ) {
    super(code);
    const control = projectAutomationStudioFailureControlRecord(failure);
    if (control !== undefined) this.failure = control;
    const measured = parseAutomationStudioTargetActionabilityRecord(actionability);
    if (measured !== undefined) this.actionability = measured;
  }
}
