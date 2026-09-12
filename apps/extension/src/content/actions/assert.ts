// The assert verb: check an authored expectation about the page.
//
// This is the one verb whose post-condition is the user's claim rather than the
// verb's own, so a claim that does not hold is STATE_MISMATCH and not
// OUTPUT_NOT_OBSERVED, which means an action ran without its effect appearing.
// Nothing here acts on the page at all. The category is the difference between
// "your expectation about this page is wrong" and "the click did not take", and
// a Flow recovers from them differently.
//
// Not every failed claim is a state mismatch, though. The evaluation polls
// until the claim holds or its window closes, so a claim whose subject never
// appeared at all -- `exists` on a selector nothing ever matched -- has not been
// judged against the page, it has run out of time waiting for it. That is
// TIMEOUT, status `timed_out`, which is what the vocabulary assigns to a wait
// that expires and what the closed set carries a code for. `assertionTimedOut`
// below is the whole rule and says why each kind falls where it does.
//
// STATE_MISMATCH is Core's `unexpected_state`, not `expected_state_missing`,
// which this file used to claim. A failed authored assertion means the page is
// in a state other than the asserted one, which is what `unexpected_state`
// names; `expected_state_missing` is Core's transition-comparison category and
// has no web code at all. The code, the category, the stage and the retryable
// flag are all read from the domain's closed set rather than written here, so
// the record cannot contradict one of Core's consistency rules and be dropped
// whole by its parser -- which loses the failure instead of reporting it.
//
// `deps.success` builds the result, so the validation text is bounded and
// non-empty exactly as every other verb's is -- Core drops an unbounded record
// whole -- and only the failure record is then replaced, using the bounded
// values the builder produced rather than the raw page text.
//
// The whole body is wrapped: `execute.ts` returns this verb's promise from
// inside its try block without awaiting it, so a rejection would escape the
// catch that turns a throw into a failure result.

import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation } from "../types";
import type { AssertionOutcome, AssertionTarget } from "../action-runtime";
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
    if (assertionTimedOut(outcome)) {
      // `deps.timedOut` is `results.ts`'s `actionTimedOut`: status `timed_out`,
      // never flattened to `failed`, carrying TIMEOUT from the same closed set.
      return deps.timedOut(action, startedAt, `Assertion did not hold within ${outcome.timeoutMs} ms: ${request.kind}.`, validation, evidence);
    }
    const message = outcome.held ? `Assertion held: ${request.kind}.` : `Assertion did not hold: ${request.kind}.`;
    const result = deps.success(action, startedAt, message, validation, evidence);
    return outcome.held ? result : { ...result, failure: stateMismatchFailure(result.validation) };
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

/**
 * Whether the claim ran out of time rather than being contradicted, which is
 * the one place this verb chooses between TIMEOUT and STATE_MISMATCH.
 *
 * The line between them is what the page let the evaluator see, not how long it
 * took. A claim whose substance was read and found wrong is a definite state
 * the page is in: `expected` and `actual` name both sides, and retrying the
 * same claim cannot change the answer on its own, which is what STATE_MISMATCH
 * says. A claim whose subject never appeared was never judged at all -- all
 * that was observed is that the page had not got there when the window closed
 * -- and that is TIMEOUT, retryable because a later attempt may find the page
 * further along.
 *
 * Both conditions are required. Without `waitExpired`, a claim given no window
 * at all would be reported as having run out of one. Without `!judged`, every
 * failed assertion would become a timeout -- a false claim is always polled to
 * the deadline -- and STATE_MISMATCH would be unreachable from this verb, which
 * is the vocabulary's own answer for an authored assertion that does not hold.
 *
 * Per kind, "never held within the timeout" therefore means: `exists` --
 * nothing ever matched, so TIMEOUT; `text`, `visible` and `enabled` -- TIMEOUT
 * while nothing matched, STATE_MISMATCH once there was an element to read;
 * `url` -- always STATE_MISMATCH, because a document always has an address to
 * compare against. `absent` is the asymmetric one: it holds when nothing
 * matches, so it cannot fail by waiting in vain, only by seeing the element it
 * was told would go, and it is therefore always STATE_MISMATCH.
 */
function assertionTimedOut(outcome: AssertionOutcome): boolean {
  return !outcome.held && outcome.waitExpired && !outcome.judged;
}

/**
 * The claim did not hold: STATE_MISMATCH, which the set fixes at
 * `unexpected_state`, stage `verification`, and not retryable.
 *
 * Not retryable is a change from the code this replaced, and it is the set's
 * judgement rather than this verb's: retrying the same assertion against the
 * same page produces the same answer, because nothing here acts on the page, so
 * a retry can only succeed if something else changes it. The wait that gives
 * the page its chance to change has already happened -- `evaluateAssertion`
 * polls until the claim holds or its timeout passes -- so by the time a failure
 * is built, waiting longer is what has already been tried.
 *
 * The kind of claim no longer appears in the code, which used to be
 * `web.assert.${kind}` and so invented six codes outside the set. It is not
 * lost: `expected` names the claim in words ("the page contains ...",
 * "#pay is enabled"), which is where a reader looks for it, and the action's own
 * `assert.kind` travels on the command.
 */
function stateMismatchFailure(validation: BrowserActionValidation): FailureRecord {
  return webAutomationFailureRecord(
    WEB_AUTOMATION_FAILURE_CODES.STATE_MISMATCH,
    validation.status === "none" ? {} : { expected: validation.expected, actual: validation.actual }
  );
}
