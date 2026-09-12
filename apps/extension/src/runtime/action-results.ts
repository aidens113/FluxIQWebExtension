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
// cannot report success without saying what it checked. Core's parser drops a
// failure record whole rather than repairing it, so text is bounded and never
// empty, and each category is paired with the stage and retryability Core's
// consistency rules allow.

import { WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH } from "@fluxiq-web-extension/domain/client";
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
 * Never retryable: the same request lands in the same place until a person or
 * the Flow changes something.
 */
export function navigationUnexpectedFailure(expected: string, actual: string): FailureRecord {
  return {
    category: "navigation_unexpected",
    code: "web.navigate.unexpected_url",
    retryable: false,
    stage: "verification",
    expected: boundedText(expected),
    actual: boundedText(actual)
  };
}

/** A wait that ran out of time. */
export function workerTimeoutFailure(code: string, expected: string, actual: string): FailureRecord {
  return {
    category: "timeout",
    code,
    retryable: true,
    stage: "execution",
    expected: boundedText(expected),
    actual: boundedText(actual)
  };
}

/**
 * The client refused the action: an unsupported page, a missing permission, or
 * a request it cannot interpret. Core forbids this category from being
 * retryable, since retrying unchanged can never succeed.
 */
export function workerBlockedFailure(code: string, compared?: { expected: string; actual: string }): FailureRecord {
  return {
    category: "blocked_by_capability_or_policy",
    code,
    retryable: false,
    stage: "dispatch",
    ...(compared ? { expected: boundedText(compared.expected), actual: boundedText(compared.actual) } : {})
  };
}

/** Nothing matched the tab the action named. Core allows this category only at the target-resolution stage. */
export function workerTargetNotFoundFailure(code: string, expected: string, actual: string): FailureRecord {
  return {
    category: "target_not_found",
    code,
    retryable: true,
    stage: "target_resolution",
    expected: boundedText(expected),
    actual: boundedText(actual)
  };
}

/** The action ran and the browser rejected it. */
export function workerActionFailedFailure(code: string, expected: string, actual: string): FailureRecord {
  return {
    category: "action_failed",
    code,
    retryable: true,
    stage: "execution",
    expected: boundedText(expected),
    actual: boundedText(actual)
  };
}

function boundedText(value: string): string {
  const collapsed = value.replace(/\s+/gu, " ").trim();
  if (!collapsed) return "(none)";
  return collapsed.length <= WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH
    ? collapsed
    : `${collapsed.slice(0, WEB_AUTOMATION_VALIDATION_TEXT_MAX_LENGTH - 1)}…`;
}
