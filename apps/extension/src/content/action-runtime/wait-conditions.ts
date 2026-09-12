// The conditions a wait can wait for.
//
// `waits.ts` supplies the engine; this is the vocabulary: `present` (existence
// in the DOM, the only condition before Phase 1.2), `visible`, `enabled`,
// `absent`, `url` (the page landed on an address), and `stable` (the DOM
// stopped changing for `stableForMs`). Each condition reports what the page
// actually showed, so a wait that succeeded and a wait that ran out of time
// both say what was observed rather than only that something went wrong.
//
// Running out of time is an outcome here (`ok: false`), not a throw: the verb
// turns it into a `timed_out` result with Core's `timeout` category rather than
// a flattened `failed`. A request that could never be satisfied -- a condition
// that needs a selector, asked without one -- does throw, because that is a
// malformed command rather than a page that was too slow.

import type { WebAutomationWaitCondition } from "../types";
import { DEFAULT_WAIT_TIMEOUT_MS, pageText, waitUntil, type WaitProgress } from "./waits";

/** How long the DOM must be quiet for under `stable` when the action names no window. */
const DEFAULT_STABLE_FOR_MS = 500;

export type WaitConditionRequest = {
  condition: WebAutomationWaitCondition;
  selector?: string | undefined;
  text?: string | undefined;
  /** The URL the `url` condition waits to land on. */
  url?: string | undefined;
  timeoutMs?: number | undefined;
  /** How long the page must stop changing for, under the `stable` condition. */
  stableForMs?: number | undefined;
};

export type WaitConditionOutcome =
  | { ok: true; condition: WebAutomationWaitCondition; element?: Element | undefined; actual: string; waitedMs: number }
  | { ok: false; condition: WebAutomationWaitCondition; actual: string; waitedMs: number };

/** What satisfying the condition looked like: the element it was about, if any, and what the page showed. */
type ConditionHit = { element?: Element | undefined; actual: string };

type ConditionEvaluator = (progress: WaitProgress) => ConditionHit | undefined;

export async function waitForCondition(request: WaitConditionRequest): Promise<WaitConditionOutcome> {
  const startedAt = Date.now();
  const hit = await waitUntil(evaluatorFor(request), request.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS);
  const waitedMs = Date.now() - startedAt;
  if (!hit) return { ok: false, condition: request.condition, actual: unmetActual(request), waitedMs };
  return {
    ok: true,
    condition: request.condition,
    ...(hit.element ? { element: hit.element } : {}),
    actual: hit.actual,
    waitedMs
  };
}

function evaluatorFor(request: WaitConditionRequest): ConditionEvaluator {
  const { condition } = request;
  if (condition === "present") return () => presentHit(request);
  if (condition === "visible") return () => visibleHit(request);
  if (condition === "enabled") return () => enabledHit(request);
  if (condition === "absent") return () => absentHit(request);
  if (condition === "url") return () => urlHit(request);
  if (condition === "stable") return (progress) => stableHit(request, progress);
  return noEvaluator(condition);
}

/** A condition the union gained with no evaluator: a build error here, never a wait that silently never holds. */
function noEvaluator(condition: never): never {
  throw new Error(`The wait condition "${String(condition)}" has no evaluator.`);
}

function presentHit(request: WaitConditionRequest): ConditionHit | undefined {
  if (request.selector) {
    const element = document.querySelector(request.selector);
    return element ? { element, actual: "the element was found" } : undefined;
  }
  return pageText().includes(requireText(request)) ? { actual: "the text was found" } : undefined;
}

function visibleHit(request: WaitConditionRequest): ConditionHit | undefined {
  if (request.selector) {
    const element = document.querySelector(request.selector);
    return element && isVisible(element) ? { element, actual: "the element was visible" } : undefined;
  }
  // `pageText()` is rendered text, so text that reads back is text the page is showing.
  return pageText().includes(requireText(request)) ? { actual: "the text was visible" } : undefined;
}

function enabledHit(request: WaitConditionRequest): ConditionHit | undefined {
  const element = document.querySelector(requireSelector(request));
  return element && isEnabled(element) ? { element, actual: "the element was enabled" } : undefined;
}

function absentHit(request: WaitConditionRequest): ConditionHit | undefined {
  if (request.selector) {
    return document.querySelector(request.selector) ? undefined : { actual: "no element matched the selector" };
  }
  return pageText().includes(requireText(request)) ? undefined : { actual: "the text was absent" };
}

function urlHit(request: WaitConditionRequest): ConditionHit | undefined {
  const requested = request.url;
  if (!requested) throw new Error('The "url" wait condition needs the URL to wait for.');
  return urlMatches(location.href, requested) ? { actual: location.href } : undefined;
}

function stableHit(request: WaitConditionRequest, progress: WaitProgress): ConditionHit | undefined {
  const stableForMs = request.stableForMs ?? DEFAULT_STABLE_FOR_MS;
  if (Date.now() - progress.lastChangeAt < stableForMs) return undefined;
  return { actual: `the page stopped changing for ${stableForMs} ms` };
}

/** What the page showed when the condition never held. The verb reports it as the validation's `actual`. */
function unmetActual(request: WaitConditionRequest): string {
  const { condition } = request;
  if (condition === "present") return request.selector ? "no element matched before the timeout" : "the text did not appear before the timeout";
  if (condition === "visible") return request.selector ? "the element was not visible before the timeout" : "the text was not visible before the timeout";
  if (condition === "enabled") return "the element was not enabled before the timeout";
  if (condition === "absent") return request.selector ? "the element was still present after the timeout" : "the text was still present after the timeout";
  if (condition === "url") return `the page was still on ${location.href}`;
  return "the page was still changing after the timeout";
}

/**
 * Visible as Playwright means it: the element has a layout box and is not
 * `visibility: hidden`. `display: none`, the `hidden` attribute and a
 * zero-sized box all collapse the box, so one rule covers them. Whether an
 * element can be *acted on* is a stricter question, and the actionability
 * capability, not a wait, answers it.
 */
function isVisible(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const visibility = getComputedStyle(element).visibility;
  return visibility !== "hidden" && visibility !== "collapse";
}

/** Enabled by the platform's own rule (`:disabled` covers a disabled fieldset too), plus the ARIA claim. */
function isEnabled(element: Element): boolean {
  if (element.getAttribute("aria-disabled") === "true") return false;
  return !element.matches(":disabled");
}

/** The landed URL counts as the requested one when it is that URL, contains it, or resolves to it. */
function urlMatches(current: string, requested: string): boolean {
  if (current === requested || current.includes(requested)) return true;
  try {
    return new URL(requested, document.baseURI).href === current;
  } catch {
    return false;
  }
}

function requireSelector(request: WaitConditionRequest): string {
  if (!request.selector) throw new Error(`The "${request.condition}" wait condition needs a selector.`);
  return request.selector;
}

function requireText(request: WaitConditionRequest): string {
  if (!request.text) throw new Error(`The "${request.condition}" wait condition needs a selector or text to wait for.`);
  return request.text;
}
