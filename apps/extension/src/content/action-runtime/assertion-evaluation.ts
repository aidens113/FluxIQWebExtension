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

import type { WebAutomationAssertRequest } from "../types";

export type AssertionTarget = { selector?: string | undefined; element?: Element | undefined };

export type AssertionOutcome = { held: boolean; expected: string; actual: string };

/** Long enough for a page to settle after the action before it, short enough that a wrong claim fails fast. */
const DEFAULT_ASSERT_TIMEOUT_MS = 5_000;

const POLL_INTERVAL_MS = 50;

export async function evaluateAssertion(request: WebAutomationAssertRequest, target: AssertionTarget): Promise<AssertionOutcome> {
  const timeoutMs = Math.max(0, request.timeoutMs ?? DEFAULT_ASSERT_TIMEOUT_MS);
  const deadline = Date.now() + timeoutMs;
  // Always judged once, so `timeoutMs: 0` is a single immediate check.
  let outcome = evaluateOnce(request, target);
  while (!outcome.held && Date.now() < deadline) {
    await delay(Math.min(POLL_INTERVAL_MS, deadline - Date.now()));
    outcome = evaluateOnce(request, target);
  }
  return outcome;
}

function evaluateOnce(request: WebAutomationAssertRequest, target: AssertionTarget): AssertionOutcome {
  if (request.kind === "url") return urlOutcome(request.expected);

  const where = target.selector ? `"${target.selector}"` : "the resolved element";
  const found = currentElement(target);
  if (request.kind === "exists") {
    if (!target.selector && !target.element) {
      return { held: false, expected: "an element to test for existence", actual: "the action named no selector and no element" };
    }
    return { held: Boolean(found), expected: `an element matching ${where} exists`, actual: found ? "it exists" : `nothing matched ${where}` };
  }
  if (request.kind === "absent") {
    return { held: !found, expected: `no element matches ${where}`, actual: found ? `${where} is still present` : `nothing matched ${where}` };
  }
  if (request.kind === "text") return textOutcome(request.expected ?? "", target, found, where);

  if (!found) {
    const claim = request.kind === "visible" ? "visible" : "enabled";
    return { held: false, expected: `${where} is ${claim}`, actual: `nothing matched ${where}` };
  }
  if (request.kind === "visible") {
    const visible = isVisible(found);
    return { held: visible, expected: `${where} is visible`, actual: visible ? "it is visible" : "it is present but not visible" };
  }
  const enabled = isEnabled(found);
  return { held: enabled, expected: `${where} is enabled`, actual: enabled ? "it is enabled" : "it is present but disabled" };
}

/** The element as it is right now: a selector is re-queried, a bare element must still be in the document. */
function currentElement(target: AssertionTarget): Element | undefined {
  if (target.selector) return document.querySelector(target.selector) ?? undefined;
  if (target.element) return target.element.isConnected ? target.element : undefined;
  return undefined;
}

/** With no target, `text` is a claim about the whole page, which is how an authored "the page says X" reads. */
function textOutcome(wanted: string, target: AssertionTarget, found: Element | undefined, where: string): AssertionOutcome {
  const scope = target.selector || target.element ? found : document.body;
  const label = target.selector || target.element ? where : "the page";
  if (!scope) return { held: false, expected: `${label} contains "${wanted}"`, actual: `nothing matched ${where}` };
  const text = readText(scope);
  return {
    held: text.includes(wanted),
    expected: `${label} contains "${wanted}"`,
    actual: text ? `${label} reads "${text}"` : `${label} has no text`
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

function urlOutcome(expected: string | undefined): AssertionOutcome {
  const href = location.href;
  const wanted = expected ?? "";
  // A substring counts, so a claim can name a path without the origin the Lab assigns at run time.
  const held = wanted !== "" && (href === wanted || href.includes(wanted));
  return {
    held,
    expected: wanted ? `the page URL is ${wanted}` : "the assertion to name the expected URL",
    actual: `the page URL is ${href}`
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
