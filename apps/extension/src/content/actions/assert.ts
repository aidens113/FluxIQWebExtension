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
// This verb builds no failure record of its own. `deps.success` is
// `action-runtime/results.ts`, which already maps a failed `web.dom.assert`
// post-condition to STATE_MISMATCH -- `unobservedOutputCode` -- so the record
// this file used to write on top of it was a second statement of the same rule.
// It also bounds the validation text, which Core requires and page text does
// not respect.
//
// The duplicate was not merely redundant; it was lossy. `results.ts` runs one
// hook after the code is chosen: `authGateFailure` replaces the record with
// AUTH_REQUIRED when the action's selector matches nothing and the document is
// a sign-in gate. Overwriting the builder's record discarded that, and the two
// codes tell an operator to do opposite things -- AUTH_REQUIRED says sign in
// again, STATE_MISMATCH says the page is not in the state the Flow claimed. The
// edge is narrow (a `url` claim carrying a stale selector on a page that has
// become a gate, since a selector matching nothing now routes to `timedOut`),
// but it is the case where naming the right one matters most: reported as a
// state mismatch, an expired session sends a person looking at the page.
//
// So both branches return the builder's result untouched, and the only choice
// left here is which builder to call.
//
// One thing the removed record said is worth keeping said: the kind of claim
// does not appear in the code. It used to -- `web.assert.${kind}`, six strings
// in no set at all -- and it is not lost, because `expected` names the claim in
// words ("the page contains ...", "#pay is enabled") and the command carries
// `assert.kind`. Neither is retryability a judgement this verb makes: the set
// fixes STATE_MISMATCH as not retryable, which is right here because nothing
// acts on the page, so the wait that gives the page its chance to change has
// already happened inside `evaluateAssertion`.
//
// The whole body is wrapped, and that is belt and braces rather than the only
// thing standing between a rejection and a failure result: `execute.ts` awaits
// every branch, so its own catch would answer for this verb if this one were
// not here. It is kept because it is free and it keeps the answer local -- a
// throw from `evaluateAssertion` is reported as this verb failing, at this
// verb's `startedAt`, without depending on how the dispatcher happens to call
// it. (Until 2026-09-11 the dispatcher returned this promise unawaited, and
// this catch was the only thing that stopped the rejection escaping.)

import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { AssertionOutcome, AssertionTarget } from "../action-runtime";
import type { ContentActionDependencies } from "./types";

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
    // `deps.success` is `results.ts`'s builder: a failed validation makes the
    // result `failed` and carries STATE_MISMATCH, because the post-condition of
    // `web.dom.assert` is the Flow's claim about the page rather than the verb's
    // own effect. The record is returned as it was built -- see the header for
    // why replacing it here lost an AUTH_REQUIRED the builder had already found.
    const message = outcome.held ? `Assertion held: ${request.kind}.` : `Assertion did not hold: ${request.kind}.`;
    return deps.success(action, startedAt, message, validation, evidence);
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
