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
// AUTH_REQUIRED when the document is a sign-in gate and either the action's
// selector matches nothing or the action is a `url` claim that names a URL and
// did not hold. Overwriting the builder's record discarded that, and the two
// codes tell an operator to do opposite things -- AUTH_REQUIRED says sign in
// again, STATE_MISMATCH says the page is not in the state the Flow claimed. For
// this verb that is not a narrow edge: every failed URL claim made on a sign-in
// gate takes that hook, and it is the case where naming the right one matters
// most: reported as a state mismatch, an expired session sends a person looking
// at the page.
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

import type { BrowserActionCommand, BrowserActionResult, BrowserActionTargetResolution } from "../types";
import type { AssertionOutcome, AssertionTarget } from "../action-runtime";
import type { ContentActionDependencies } from "./types";

export async function assertAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): Promise<BrowserActionResult> {
  try {
    const request = action.assert;
    if (!request) throw new Error("web.dom.assert requires assert parameters naming the kind of claim.");

    const { target, resolution } = assertionTarget(action, deps);
    const outcome = await deps.evaluateAssertion(request, target);
    // A text claim that did not hold says what the page held of the text
    // (t369): hidden or absent, and the shown text most like it.
    const textSighting = !outcome.held && request.kind === "text" && request.expected?.trim() ? deps.sightText(request.expected) : undefined;
    const evidence = {
      ...(target.element ? { element: deps.describeElement(target.element) } : {}),
      snapshot: deps.captureSnapshot(),
      ...(resolution ? { resolution } : {}),
      ...(textSighting ? { textSighting } : {})
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

/** What the claim is judged against, and the measurement behind it when one was made. */
type ResolvedAssertionTarget = {
  target: AssertionTarget;
  resolution?: BrowserActionTargetResolution | undefined;
};

/**
 * A selector is handed over unresolved, because `exists` and `absent` are
 * claims about whether anything matches it and `deps.resolveTarget` throws when
 * nothing does. It goes with the recorded host chain of a target written inside
 * a shadow root, so it is asked where it was written and not of the light
 * document, which it says nothing about. Without one, the target is resolved however the action names it
 * -- coordinates, visual bounds, fingerprint -- and a miss leaves an empty
 * target the capability reports as "nothing matched" rather than a throw.
 *
 * The measurement comes back with the element and only with it, which is why
 * this verb reports a resolution on some results and not others: a claim about
 * a selector resolved nothing, and a claim whose target could not be resolved
 * measured nothing worth reporting either.
 *
 * A check scoped to one row is the exception to the selector rule. Inside a
 * repeat the domain writes the pass's row into `element.context.record` as
 * `values` (`webAutomationScopedToRow`), and the Flow's own click resolves
 * through `resolveTarget`, whose record gate admits only a control inside a
 * record holding every value. The recorded selector names the build's own row,
 * so handing it over bare checked a different control from the one the Flow
 * presses: in live run `run-musp474o-e0ed7432` every pass of a repeated Confirm
 * check answered "visible and enabled", including the pass for a row whose
 * Confirm was already gone, because each asked about the template card. So a
 * row-scoped check resolves exactly as the click does, and a row holding no such
 * control leaves an empty target -- "nothing matched", a wait in vain -- rather
 * than falling back to the selector that names another row.
 */
function assertionTarget(action: BrowserActionCommand, deps: ContentActionDependencies): ResolvedAssertionTarget {
  // An absent claim must name its subject; an unscoped text claim reads the page.
  // Generic action resolution can infer the focused field, which authors neither.
  if ((action.assert?.kind === "absent" || action.assert?.kind === "text") && !hasAuthoredAssertionTarget(action)) return { target: {} };
  if (action.selector && !scopedToRow(action)) return { target: { selector: action.selector, shadowHosts: recordedShadowHosts(action) } };
  try {
    const resolved = deps.resolveTarget(action);
    return { target: { element: resolved.element }, resolution: resolved.resolution };
  } catch {
    return { target: {} };
  }
}

/** Target fields accepted by ordinary resolution, excluding its implicit focus fallback. */
function hasAuthoredAssertionTarget(action: BrowserActionCommand): boolean {
  if (action.selector?.trim() || action.coordinates || action.visualTarget?.documentBounds || action.visualTarget?.bounds || action.visualTarget?.anchor?.bounds) return true;
  return [action.element, action.options?.element].some((value) => value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0);
}

/**
 * The host chain the target was recorded under, from the declared element or
 * the raw one beside it in `options` -- the two places the resolver reads a
 * recorded target from -- and only when it is a list of selectors.
 */
function recordedShadowHosts(action: BrowserActionCommand): readonly string[] | undefined {
  for (const element of [action.element, action.options?.element]) {
    const context = element && typeof element === "object" ? (element as { context?: unknown }).context : undefined;
    const hosts = context && typeof context === "object" ? (context as { shadowHosts?: unknown }).shadowHosts : undefined;
    if (Array.isArray(hosts) && hosts.length && hosts.every((host) => typeof host === "string")) return hosts as string[];
  }
  return undefined;
}

/**
 * Whether the recorded target carries a repeat pass's row: `context.record.values`
 * as a non-empty list, from either place the resolver reads a recorded target.
 * Only the domain's row scoping writes `values`, so a recording's own record --
 * a key or its text -- leaves a check on the selector as before.
 */
function scopedToRow(action: BrowserActionCommand): boolean {
  return [action.element, action.options?.element].some((element) => {
    const context = element && typeof element === "object" ? (element as { context?: unknown }).context : undefined;
    const record = context && typeof context === "object" ? (context as { record?: unknown }).record : undefined;
    const values = record && typeof record === "object" ? (record as { values?: unknown }).values : undefined;
    return Array.isArray(values) && values.length > 0;
  });
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
