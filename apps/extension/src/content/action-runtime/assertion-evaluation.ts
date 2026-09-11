// Evaluating an authored expectation about the page.
//
// `web.dom.assert` is how a Flow states what must be true, so unlike a verb's
// own post-condition this is the user's claim: exists, absent, text, url,
// visible, or enabled, each retried until it holds or the timeout passes. The
// outcome always reports `expected` and `actual`, because a claim that does not
// hold is reported as STATE_MISMATCH with both sides, not as a bare failure.
//
// The target carries a selector as well as an element: `absent` has no element
// to hand over by definition, and `exists` must be able to say that nothing
// matched.
//
// Owned by `w2-check-assert`, which replaces this stub.

import type { WebAutomationAssertRequest } from "../types";

export type AssertionTarget = { selector?: string | undefined; element?: Element | undefined };

export type AssertionOutcome = { held: boolean; expected: string; actual: string };

export function evaluateAssertion(_request: WebAutomationAssertRequest, _target: AssertionTarget): Promise<AssertionOutcome> {
  throw new Error("The assertion-evaluation capability is not implemented yet.");
}
