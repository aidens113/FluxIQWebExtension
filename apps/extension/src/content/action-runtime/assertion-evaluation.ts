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
// A selector written inside a shadow root is looked for in the roots its
// recorded host chain reaches (`../selector`'s `resolveShadowScope`, the scope
// the resolver presses in), never in the light document around it, where it
// means nothing. Until t195-w24a it was asked of the document alone, so a
// control inside a widget -- bigbox's store chooser -- matched nothing however
// plainly it was there, and a `visible` claim about it read as a subject that
// never appeared.
//
// A `visible` claim that fails on an element that is there says which of two
// things hid it, and the build's dry run, which checks a step whose effect
// lasts rather than pressing it, reads which
// (`domain/src/runtime/llm-evidence/node-run/hidden-target.ts`):
//
//   enclosed -- a container the element sits in is closed. An ancestor, across
//     shadow boundaries, is not rendered (`display: none`, which the `hidden`
//     attribute gives), is a `<details>` that is not open while the element is
//     not its summary, or hides what it holds (`visibility: hidden` the element
//     inherits). `actual` leads with the closed word `enclosed:`. The control is
//     there and nothing offers it until something opens the container -- a step
//     the Flow cannot take: bigbox's "Set as my store" inside the store
//     chooser's closed flyout, in a Flow that never pressed the chip that opens
//     it (`run-muq6lqnw-fdfa7aac`).
//   itself -- every container is open and the element alone is not shown: its
//     own `display`, `visibility`, opacity or box. `actual` is the sentence it
//     always was. That is how a control withdrawn once its effect is in place
//     looks -- a "Follow" hidden beside the "Following" that replaced it.
//
// The outcome carries its timing as well as its verdict, because without it the
// verb cannot tell a claim that was false immediately from one that was false
// for the whole window, and a test cannot tell a wait that ran from a wait that
// was deleted. `validation-outcome.ts` turns the two into a status.

import { resolveShadowScope } from "../selector";
import { composedParent } from "../shadow-dom";
import type { WebAutomationAssertRequest } from "../types";

/**
 * What a claim is about. `shadowHosts` is the recorded host chain of a target
 * written inside a shadow root, so its `selector` is asked in those roots.
 */
export type AssertionTarget = { selector?: string | undefined; element?: Element | undefined; shadowHosts?: readonly string[] | undefined };

/**
 * What a failed `visible` claim says when a container the element sits in is
 * closed. The leading word is closed and is read by the domain's dry-run check
 * (`domain/src/runtime/llm-evidence/node-run/hidden-target.ts`), the way
 * `covered:` leads an actionability refusal; the rest is prose.
 */
const ASSERTION_ENCLOSED_ACTUAL = "enclosed: it is present inside a closed container, so it is not visible";

/** What a failed `visible` claim says when the element alone is not shown. Pinned word for word by the harness. */
const ASSERTION_HIDDEN_ACTUAL = "it is present but not visible";

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
    // A closed container hides what it holds even where the element still
    // reports a box of its own, as a closed `<details>` may.
    const enclosed = isInsideClosedContainer(found);
    const visible = !enclosed && isVisible(found);
    const actual = visible ? "it is visible" : enclosed ? ASSERTION_ENCLOSED_ACTUAL : ASSERTION_HIDDEN_ACTUAL;
    return { held: visible, expected: `${where} is visible`, actual, verdict: "judged" };
  }
  const enabled = isEnabled(found);
  return { held: enabled, expected: `${where} is enabled`, actual: enabled ? "it is enabled" : "it is present but disabled", verdict: "judged" };
}

/** The element as it is right now: a selector is re-queried, a bare element must still be in the document. */
function currentElement(target: AssertionTarget): Element | undefined {
  if (target.selector) return firstMatch(target.selector, target.shadowHosts);
  if (target.element) return target.element.isConnected ? target.element : undefined;
  return undefined;
}

/**
 * The first element `selector` matches: in the document, or -- for a target
 * recorded inside a shadow root -- in the roots its host chain reaches now,
 * resolved again on every attempt so a widget that renders late is still found.
 */
function firstMatch(selector: string, hosts: readonly string[] | undefined): Element | undefined {
  if (!hosts?.length) return document.querySelector(selector) ?? undefined;
  for (const root of resolveShadowScope(hosts).roots) {
    const found = root.querySelector(selector);
    if (found) return found;
  }
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
  const style = viewOf(element).getComputedStyle(element);
  return style.visibility !== "hidden" && style.display !== "none" && Number.parseFloat(style.opacity) !== 0;
}

/**
 * Whether a container the element sits in is closed, so it is not shown
 * whatever its own style says. The header names the three ways a container
 * closes; anything else that hides an element is the element's own.
 */
function isInsideClosedContainer(element: Element): boolean {
  const view = viewOf(element);
  const parent = composedParent(element);
  // Visibility is inherited, so an element that is not visible while its parent
  // is not either was hidden with its container, not on its own.
  if (parent && !visibilityShown(view.getComputedStyle(element).visibility) && !visibilityShown(view.getComputedStyle(parent).visibility)) return true;
  let child = element;
  for (let ancestor = parent; ancestor; child = ancestor, ancestor = composedParent(ancestor)) {
    if (view.getComputedStyle(ancestor).display === "none") return true;
    // A closed disclosure renders its summary and nothing else.
    if (ancestor.tagName === "DETAILS" && !ancestor.hasAttribute("open") && child.tagName !== "SUMMARY") return true;
  }
  return false;
}

function visibilityShown(visibility: string | undefined): boolean {
  return visibility === undefined || visibility === "" || visibility === "visible";
}

/** The element's own window, as the actionability gate reads style: right in a frame, and in a stub page. */
function viewOf(element: Element): Pick<Window, "getComputedStyle"> {
  return element.ownerDocument?.defaultView ?? window;
}

/** `:disabled` covers an ancestor `<fieldset disabled>`; `aria-disabled` covers a control the page only claims is off. */
function isEnabled(element: Element): boolean {
  return !element.matches(":disabled") && element.getAttribute("aria-disabled") !== "true";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}
