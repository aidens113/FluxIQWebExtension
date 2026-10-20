// The dependencies the click verb reads, and the actionability gate's answers
// the click tests give it (`actions/tests/click.test.ts`). Moved out of
// `click.test.ts` on 2026-10-20, unchanged.

import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord, type WebAutomationFailureCode } from "@fluxiq-web-extension/domain/client";
import type { ActionabilityRejectionCode, ActionabilityReport, RateLimitNotice, RobotCheckSighting } from "../../../action-runtime";
import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation } from "../../../types";
import type { ContentActionDependencies } from "../../types";
import type { CheckRecord, IgnoredRecord, NoticeRecord } from "./watches";

/** The dependencies the click verb reads, with a result builder that keeps only the verdict. Anything else it reaches for throws. */
export function dependencies(
  element: Element,
  watchInPlaceEffect: ContentActionDependencies["watchInPlaceEffect"],
  notices: { make: ContentActionDependencies["watchRateLimitNotice"]; record: NoticeRecord },
  checks: { make: ContentActionDependencies["watchRobotCheck"]; record: CheckRecord },
  ignored: { make: ContentActionDependencies["watchIgnoredPress"]; record: IgnoredRecord },
  pressableAgain: boolean,
  againAs: ActionabilityRejectionCode = "covered",
  judgedAs?: () => ActionabilityReport
): ContentActionDependencies {
  let judged = 0;
  const provided: Partial<ContentActionDependencies> = {
    resolveTarget: () => ({ element, resolution: {} as ReturnType<ContentActionDependencies["resolveTarget"]>["resolution"] }),
    checkActionability: () => {
      judged += 1;
      if (judgedAs) return judgedAs();
      return judged === 1 || pressableAgain ? PRESSABLE : notPressable(againAs);
    },
    // The record the real builder writes for a gate's refusal (`results.ts`): its reason word leads `actual`.
    rejected: (action: BrowserActionCommand, startedAt: number, code: string, expected: string, actual: string): BrowserActionResult => ({
      commandId: action.commandId,
      actionType: action.actionType,
      status: "failed",
      message: `Action rejected: ${actual}`,
      validation: { status: "failed", expected, actual },
      failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_ACTIONABLE, { expected, actual: `${code}: ${actual}` }),
      startedAt,
      finishedAt: startedAt
    }),
    describeElement: () => ({}) as ReturnType<ContentActionDependencies["describeElement"]>,
    captureSnapshot: () => ({}) as ReturnType<ContentActionDependencies["captureSnapshot"]>,
    watchInPlaceEffect,
    watchRateLimitNotice: notices.make,
    watchRobotCheck: checks.make,
    watchIgnoredPress: ignored.make,
    needsPerson: (action: BrowserActionCommand, startedAt: number, sighting: RobotCheckSighting): BrowserActionResult => {
      checks.record.handedOver.push(sighting);
      return {
        commandId: action.commandId,
        actionType: action.actionType,
        status: "failed",
        validation: { status: "failed", expected: "the page answers the press", actual: "a robot check" },
        failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED, { actual: "captcha: a robot check" }),
        startedAt,
        finishedAt: startedAt
      };
    },
    rateLimited: (action: BrowserActionCommand, startedAt: number, notice: RateLimitNotice): BrowserActionResult => {
      notices.record.refusedWith.push(notice);
      return {
        commandId: action.commandId,
        actionType: action.actionType,
        status: "failed",
        validation: { status: "failed", expected: "the page accepts the press", actual: "refused" },
        failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED, { retryAfterMs: notice.retryAfterMs }),
        startedAt,
        finishedAt: startedAt
      };
    },
    refusedByPage: (action: BrowserActionCommand, startedAt: number, notice: RateLimitNotice): BrowserActionResult => {
      notices.record.refusedByPageWith.push(notice);
      return {
        commandId: action.commandId,
        actionType: action.actionType,
        status: "failed",
        validation: { status: "failed", expected: "the page accepts the press", actual: "refused: needs something first" },
        failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.REFUSED_BY_PAGE),
        startedAt,
        finishedAt: startedAt
      };
    },
    // As the real builder (`results.ts`): a failed validation carries the code the verb named, when it named one.
    success: (action: BrowserActionCommand, startedAt: number, message: string, validation: BrowserActionValidation, _evidence?: unknown, failureCode?: WebAutomationFailureCode): BrowserActionResult => ({
      commandId: action.commandId,
      actionType: action.actionType,
      status: validation.status === "failed" ? "failed" : "succeeded",
      message,
      validation,
      ...(validation.status === "failed" && failureCode ? { failure: webAutomationFailureRecord(failureCode, { expected: validation.expected, actual: validation.actual }) } : {}),
      startedAt,
      finishedAt: startedAt
    })
  };
  return new Proxy(provided as ContentActionDependencies, {
    get(target, property: string | symbol) {
      const found = (target as unknown as Record<string | symbol, unknown>)[property];
      if (found !== undefined || typeof property === "symbol") return found;
      throw new Error(`the click verb reached for ${property}, which this test does not provide`);
    }
  });
}

/** The gate's answer for a control that can be pressed. */
export const PRESSABLE: ActionabilityReport = { actionable: true, point: { x: 10, y: 20 }, detail: "the point 10,20 landed on the target" };

/** What the gate says of a layer over the control: what the point landed on, and the layer it belongs to (`covering-layer.ts`). */
export const COVER_DETAIL = `the point 10,20 landed on a card, which covers the target; it is under the layer "Hi, I'm Val"`;

/** The gate's answer for a control that can no longer be pressed, for each of its reasons. */
export function notPressable(code: ActionabilityRejectionCode): ActionabilityReport {
  if (code === "covered") return { actionable: false, code, detail: COVER_DETAIL, point: { x: 10, y: 20 } };
  return { actionable: false, code, detail: code === "disabled" ? "the element is disabled" : "the element is not in the document" };
}
