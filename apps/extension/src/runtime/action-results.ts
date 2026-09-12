// The result an action performed by the background worker reports, and the
// structured failures that go with it.
//
// The content script has its own builders (`content/action-runtime/results.ts`)
// which read `location` and `document`; neither exists in a service worker, and
// the content bundle must not import the domain barrel, so the two sides cannot
// share one module today. What they do share is the bound: the text limit comes
// from the domain, which takes it from Core, rather than being restated here.
//
// Every result carries a validation (decision D4), so a worker-side action
// cannot report success without saying what it checked. Its text is bounded
// here, and never empty; a failure record's text is bounded by the domain,
// which drops an empty description rather than sending one, because Core's
// parser refuses it and drops the whole record with it.
//
// Every failure record this module builds comes from the domain's closed set,
// through `webAutomationFailureRecord`: the caller names a code and what it can
// say about the failure, and the category, the retryable flag and the stage
// come from the one table that binds them. The `code` parameter is typed
// `WebAutomationFailureCode`, so a string outside the set is a compile error at
// the call site rather than a record no consumer can name. It used to be
// `string`, and that is how eight codes in no set -- `web.page.unsupported`,
// `web.tab.*`, `web.download.*` -- reached the wire from `action-runner.ts`,
// `browser-tab.ts` and `browser-download.ts`.
//
// The builders that remain add only their names and the shape of what a call
// site must say: a timeout, a target and a failed action must each state an
// expected and an actual, while a refusal may state neither.

import {
  WEB_AUTOMATION_FAILURE_CODES,
  WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH,
  webAutomationFailureRecord
} from "@fluxiq-web-extension/domain/client";
import type { WebAutomationFailureCode } from "@fluxiq-web-extension/domain/client";
import type {
  BrowserActionCommand,
  BrowserActionResult,
  BrowserActionStatus,
  BrowserActionValidation
} from "../shared/protocol";

/** Core's structured failure record, reached through the result type rather than imported by name. */
type FailureRecord = NonNullable<BrowserActionResult["failure"]>;

export type WorkerActionOutcome = {
  status: BrowserActionStatus;
  message: string;
  validation: BrowserActionValidation;
  failure?: FailureRecord | undefined;
  /** Where the browser ended up, when the action knows it. */
  url?: string | undefined;
};

/** Assembles a worker-side result. The validation's text is bounded on the way in. */
export function workerActionResult(
  action: BrowserActionCommand,
  startedAt: number,
  outcome: WorkerActionOutcome
): BrowserActionResult {
  const result: BrowserActionResult = {
    commandId: action.commandId,
    actionType: action.actionType,
    status: outcome.status,
    validation: boundWorkerValidation(outcome.validation),
    message: outcome.message,
    startedAt,
    finishedAt: Date.now()
  };
  if (outcome.url !== undefined) result.url = outcome.url;
  if (outcome.failure !== undefined) result.failure = outcome.failure;
  if (action.visualTarget !== undefined) result.visualTarget = action.visualTarget;
  return result;
}

/** The validation as it may be reported: its text bounded to what Core's parser accepts. */
export function boundWorkerValidation(validation: BrowserActionValidation): BrowserActionValidation {
  if (validation.status === "none") return validation;
  return {
    status: validation.status,
    expected: boundedText(validation.expected),
    actual: boundedText(validation.actual)
  };
}

/**
 * The browser committed a navigation to somewhere other than the requested URL.
 *
 * Built from the closed set rather than assembled here, so the category, the
 * retryable flag and the stage come from the one table that binds them:
 * `navigation_unexpected`, never retryable -- the same request lands in the
 * same place until a person or the Flow changes something -- and stage
 * `confirmation`, because the navigation is what is being confirmed. The code
 * this used to write by hand, `web.navigate.unexpected_url`, was in no set at
 * all, so a consumer deriving its vocabulary from the domain could not name it.
 */
export function navigationUnexpectedFailure(expected: string, actual: string): FailureRecord {
  return webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.NAVIGATION_UNEXPECTED, { expected, actual });
}

/**
 * A wait that ran out of time. The set's member is `TIMEOUT`, which carries the
 * `timeout` category, stage `execution` and retryable -- the same record this
 * built by hand, so nothing about a worker-side timeout changes but its code.
 */
export function workerTimeoutFailure(code: WebAutomationFailureCode, expected: string, actual: string): FailureRecord {
  return webAutomationFailureRecord(code, { expected, actual });
}

/**
 * The client refused the action: an unsupported page, a missing permission, or
 * a request it cannot interpret. The set's member is `ACTION_REJECTED`, which
 * Core forbids from ever being retryable, since retrying unchanged can never
 * succeed.
 *
 * Its stage is `execution`, where this used to say `dispatch`. Every call site
 * decides before anything runs, so `dispatch` was the more literal answer, but
 * the set binds one stage to one code and stretching a member is what the set
 * is for -- the alternative, a code per reason, is the drift it exists to stop.
 * The reason itself is not lost: it rides in `expected` and `actual`.
 */
export function workerBlockedFailure(code: WebAutomationFailureCode, compared?: { expected: string; actual: string }): FailureRecord {
  return webAutomationFailureRecord(code, compared ?? {});
}

/**
 * Nothing matched the tab the action named. The set's member is
 * `TARGET_NOT_FOUND`, whose stage is `target_resolution` -- written with DOM
 * elements in mind, and honest here too: a tab is the thing the action named,
 * and naming something that does not exist is the same failure whether it is an
 * element, a frame (`action-runner.ts` already reports both that way) or a tab.
 */
export function workerTargetNotFoundFailure(code: WebAutomationFailureCode, expected: string, actual: string): FailureRecord {
  return webAutomationFailureRecord(code, { expected, actual });
}

/**
 * The action ran and the browser rejected it. The set's member is
 * `ACTION_FAILED` -- "the action ran and failed for a reason no other code
 * names" -- which carries the `action_failed` category, stage `execution` and
 * retryable, exactly what this built by hand. Not `UNKNOWN`: that means nothing
 * said why, and every call site here says why in `actual`.
 */
export function workerActionFailedFailure(code: WebAutomationFailureCode, expected: string, actual: string): FailureRecord {
  return webAutomationFailureRecord(code, { expected, actual });
}

function boundedText(value: string): string {
  const collapsed = value.replace(/\s+/gu, " ").trim();
  if (!collapsed) return "(none)";
  return collapsed.length <= WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH
    ? collapsed
    : `${collapsed.slice(0, WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH - 1)}…`;
}
