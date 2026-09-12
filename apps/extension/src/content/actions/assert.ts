// The assert verb: check an authored expectation about the page.
//
// This is the one verb whose post-condition is the user's claim rather than the
// verb's own, so a claim that does not hold is STATE_MISMATCH -- Core's
// `expected_state_missing` -- and not `output_not_observed`, which means an
// action ran without its effect appearing. Nothing here acts on the page at
// all. The category is the difference between "your expectation about this page
// is wrong" and "the click did not take", and a Flow recovers from them
// differently.
//
// `deps.success` builds the result, so the validation text is bounded and
// non-empty exactly as every other verb's is -- Core drops an unbounded record
// whole -- and only the failure record is then replaced, using the bounded
// values the builder produced rather than the raw page text.
//
// The whole body is wrapped: `execute.ts` returns this verb's promise from
// inside its try block without awaiting it, so a rejection would escape the
// catch that turns a throw into a failure result.

import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation, WebAutomationAssertKind } from "../types";
import type { AssertionTarget } from "../action-runtime";
import type { ContentActionDependencies } from "./types";

type FailureRecord = NonNullable<BrowserActionResult["failure"]>;

export async function assertAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): Promise<BrowserActionResult> {
  try {
    const request = action.assert;
    if (!request) throw new Error("web.dom.assert requires assert parameters naming the kind of claim.");

    const target = assertionTarget(action, deps);
    const outcome = await deps.evaluateAssertion(request, target);
    const evidence = {
      ...(target.element ? { element: deps.describeElement(target.element) } : {}),
      snapshot: deps.captureSnapshot()
    };

    const validation = outcome.held
      ? ({ status: "passed", expected: outcome.expected, actual: outcome.actual } as const)
      : ({ status: "failed", expected: outcome.expected, actual: outcome.actual } as const);
    const message = outcome.held ? `Assertion held: ${request.kind}.` : `Assertion did not hold: ${request.kind}.`;
    const result = deps.success(action, startedAt, message, validation, evidence);
    return outcome.held ? result : { ...result, failure: stateMismatchFailure(request.kind, result.validation) };
  } catch (error) {
    return deps.failure(action, error, startedAt);
  }
}

/**
 * A selector is handed over unresolved, because `exists` and `absent` are
 * claims about whether anything matches it and `deps.resolveTarget` throws when
 * nothing does. Without one, the target is resolved however the action names it
 * -- coordinates, visual bounds, fingerprint -- and a miss leaves an empty
 * target the capability reports as "nothing matched" rather than a throw.
 */
function assertionTarget(action: BrowserActionCommand, deps: ContentActionDependencies): AssertionTarget {
  if (action.selector) return { selector: action.selector };
  try {
    return { element: deps.resolveTarget(action) };
  } catch {
    return {};
  }
}

/** STATE_MISMATCH: Core's `expected_state_missing`, retryable because the page may still reach the expected state. */
function stateMismatchFailure(kind: WebAutomationAssertKind, validation: BrowserActionValidation): FailureRecord {
  return {
    category: "expected_state_missing",
    code: `web.assert.${kind}`,
    retryable: true,
    stage: "verification",
    ...(validation.status === "none" ? {} : { expected: validation.expected, actual: validation.actual })
  };
}
