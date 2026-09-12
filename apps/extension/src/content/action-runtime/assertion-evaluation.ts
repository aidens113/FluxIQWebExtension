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
// The selector is re-queried on every attempt rather than resolved once, which
// is what makes a claim about a changing page meaningful: `exists` sees an
// element that arrives late, and `absent` sees one that detaches. When the
// target is an element with no selector, `isConnected` plays the same part.
//
// Why polling rather than a MutationObserver, as `waits.ts` uses: `url` and
// `visible` change without any mutation -- a history navigation, a scroll, a
// CSS transition -- so an observer would sleep through exactly the claims this
// module exists to judge.
//
// The outcome carries its timing as well as its verdict, because without it the
// verb cannot tell a claim that was false immediately from one that was false
// for the whole window, and a test cannot tell a wait that ran from a wait that
// was deleted. `validation-outcome.ts` turns the two into a status.

import type { WebAutomationAssertRequest } from "../types";

export type AssertionTarget = { selector?: string | undefined; element?: Element | undefined };

/**
 * What one attempt could say about the claim. This is the distinction the
 * TIMEOUT / STATE_MISMATCH choice rests on, so it is decided where the page is
 * read rather than inferred later from the wording of `actual`.
 *
 * - `judged` -- the claim's substance was read and the page either agrees or
 *   disagrees. A disagreement is a definite observed state.
 * - `pending` -- the subject of the claim was not there to judge, so the only
 *   thing observed is that the page has not got there yet.
 * - `malformed` -- the request names no claim any page could satisfy, so
 *   waiting is pointless and the loop stops at once.
 */
type AssertionVerdict = "judged" | "pending" | "malformed";

type AssertionAttempt = { held: boolean; expected: string; actual: string; verdict: AssertionVerdict };

export type AssertionOutcome = {
  held: boolean;
  expected: string;
  actual: string;
  /** Whether the last attempt read the claim's substance, rather than reporting that its subject was not there yet. */
  judged: boolean;
  /** The claim never held and the polling window ran out. False when there was no window, and when nothing could satisfy the claim. */
  waitExpired: boolean;
  /** The window the claim was given, how long judging it actually took, and how many times it was judged. */
  timeoutMs: number;
  elapsedMs: number;
  attempts: number;
};

/** Long enough for a page to settle after the action before it, short enough that a wrong claim fails fast. */
const DEFAULT_ASSERT_TIMEOUT_MS = 5_000;

const POLL_INTERVAL_MS = 50;

export async function evaluateAssertion(request: WebAutomationAssertRequest, target: AssertionTarget): Promise<AssertionOutcome> {
  const timeoutMs = Math.max(0, request.timeoutMs ?? DEFAULT_ASSERT_TIMEOUT_MS);
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  // Always judged once, so `timeoutMs: 0` is a single immediate check.
  let attempt = evaluateOnce(request, target);
  let attempts = 1;
  while (!attempt.held && attempt.verdict !== "malformed" && Date.now() < deadline) {
    await delay(Math.min(POLL_INTERVAL_MS, deadline - Date.now()));
    attempt = evaluateOnce(request, target);
    attempts += 1;
  }
  return {
    held: attempt.held,
    expected: attempt.expected,
    actual: attempt.actual,
    judged: attempt.verdict === "judged",
    // A window only expires if there was one and it ran out. A claim given no
    // time, and a claim nothing could satisfy, waited for nothing -- reporting
    // either as a timeout would blame the page for the request.
    waitExpired: !attempt.held && attempt.verdict !== "malformed" && timeoutMs > 0 && Date.now() >= deadline,
    timeoutMs,
    elapsedMs: Date.now() - startedAt,
    attempts
  };
}

function evaluateOnce(request: WebAutomationAssertRequest, target: AssertionTarget): AssertionAttempt {
  if (request.kind === "url") return urlOutcome(request.expected);

  const where = target.selector ? `"${target.selector}"` : "the resolved element";
  const found = currentElement(target);
  if (request.kind === "exists") {
    if (!target.selector && !target.element) {
      return { held: false, expected: "an element to test for existence", actual: "the action named no selector and no element", verdict: "malformed" };
    }
    // Nothing matching is not a judgement about the page's state, it is the
    // page not having got there: `exists` fails only by waiting in vain.
    return found
      ? { held: true, expected: `an element matching ${where} exists`, actual: "it exists", verdict: "judged" }
      : { held: false, expected: `an element matching ${where} exists`, actual: `nothing matched ${where}`, verdict: "pending" };
  }
  if (request.kind === "absent") {
    // The one kind with no pending state, and the reason it is not the mirror
    // of `exists`: `absent` holds when nothing matches, so its only failure is
    // seeing the element -- a definite observation, never a wait in vain.
    return found
      ? { held: false, expected: `no element matches ${where}`, actual: `${where} is still present`, verdict: "judged" }
      : { held: true, expected: `no element matches ${where}`, actual: `nothing matched ${where}`, verdict: "judged" };
  }
  if (request.kind === "text") return textOutcome(request.expected ?? "", target, found, where);

  if (!found) {
    const claim = request.kind === "visible" ? "visible" : "enabled";
    return { held: false, expected: `${where} is ${claim}`, actual: `nothing matched ${where}`, verdict: "pending" };
  }
  if (request.kind === "visible") {
    const visible = isVisible(found);
    return { held: visible, expected: `${where} is visible`, actual: visible ? "it is visible" : "it is present but not visible", verdict: "judged" };
  }
  const enabled = isEnabled(found);
  return { held: enabled, expected: `${where} is enabled`, actual: enabled ? "it is enabled" : "it is present but disabled", verdict: "judged" };
}

/** The element as it is right now: a selector is re-queried, a bare element must still be in the document. */
function currentElement(target: AssertionTarget): Element | undefined {
  if (target.selector) return document.querySelector(target.selector) ?? undefined;
  if (target.element) return target.element.isConnected ? target.element : undefined;
  return undefined;
}

/** With no target, `text` is a claim about the whole page, which is how an authored "the page says X" reads. */
function textOutcome(wanted: string, target: AssertionTarget, found: Element | undefined, where: string): AssertionAttempt {
  const scope = target.selector || target.element ? found : document.body;
  const label = target.selector || target.element ? where : "the page";
  // No scope is no text to read, so the claim has not been judged yet: the
  // element the text belongs to may still arrive.
  if (!scope) return { held: false, expected: `${label} contains "${wanted}"`, actual: `nothing matched ${where}`, verdict: "pending" };
  const text = readText(scope);
  return {
    held: text.includes(wanted),
    expected: `${label} contains "${wanted}"`,
    actual: text ? `${label} reads "${text}"` : `${label} has no text`,
    verdict: "judged"
  };
}

/** A field's text is what it holds, not what it renders: `innerText` of an input is empty. */
function readText(element: Element): string {
  const tagName = element.tagName;
  const value = tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT"
    ? (element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value
    : (element as HTMLElement).innerText ?? element.textContent ?? "";
  return value.replace(/\s+/gu, " ").trim();
}

function urlOutcome(expected: string | undefined): AssertionAttempt {
  const href = location.href;
  const wanted = expected ?? "";
  // A substring counts, so a claim can name a path without the origin the Lab assigns at run time.
  const held = wanted !== "" && (href === wanted || href.includes(wanted));
  return {
    held,
    expected: wanted ? `the page URL is ${wanted}` : "the assertion to name the expected URL",
    actual: `the page URL is ${href}`,
    // The document's address is always readable, so a URL claim is always
    // judged -- unless the claim named no URL, which no page can satisfy.
    verdict: wanted ? "judged" : "malformed"
  };
}

/** Visible as a person would judge it: a box with area, not `display:none`, `visibility:hidden`, or fully transparent. */
function isVisible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = getComputedStyle(element);
  return style.visibility !== "hidden" && style.display !== "none" && Number.parseFloat(style.opacity) !== 0;
}

/** `:disabled` covers an ancestor `<fieldset disabled>`; `aria-disabled` covers a control the page only claims is off. */
function isEnabled(element: Element): boolean {
  return !element.matches(":disabled") && element.getAttribute("aria-disabled") !== "true";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}
