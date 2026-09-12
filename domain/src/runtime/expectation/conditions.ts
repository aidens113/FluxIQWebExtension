// Reading a `web.dom.assert` claim out of an authored expected state.
//
// Core hands the host `expectedState.conditions` as raw JSON and never looks
// inside it: only the host can see the page, so only the host can say what a
// condition means. This module is the one place that JSON becomes a request the
// browser can run.
//
// It refuses rather than coerces. A condition it cannot read is reported as
// unevaluated, never as a failure: before this seam existed Core passed every
// expectation unconditionally, so a shape we do not understand must not turn
// into a red run.
//
// Two shapes are accepted, because two producers write conditions. A Flow
// author writes the flat `{ kind, expected, selector }`; a recorded or authored
// `web.dom.assert` output node carries `{ selector, assert: { kind, expected } }`,
// which is the shape `domain/src/output-nodes` writes into
// `parameterValues.expectedState`. Both name the same claim.

import type { JsonObject, JsonValue } from "fluxiq/core";
import type { WebAutomationAssertKind, WebAutomationAssertRequest } from "../../actions/types";

/** One readable claim about the page, with the timeout that bounds its wait already resolved. */
export type WebAutomationExpectationCondition = {
  assert: WebAutomationAssertRequest & { timeoutMs: number };
  selector?: string | undefined;
  frameId?: number | undefined;
  tabId?: number | undefined;
};

/**
 * Exhaustive by construction: the union in `actions/types.ts` gains a kind and
 * this object stops type-checking, so a new claim cannot be silently dropped as
 * unreadable here.
 */
const ASSERT_KINDS: Readonly<Record<WebAutomationAssertKind, true>> = Object.freeze({
  exists: true,
  absent: true,
  text: true,
  url: true,
  visible: true,
  enabled: true
});

/**
 * The smallest wait the wire can carry.
 *
 * `gateway-action-parameters.ts` reads `assert.timeoutMs` with a
 * positive-integer guard, so a literal `0` is dropped and the content script
 * falls back to its own five-second default. Core's transition comparison
 * passes `timeoutMs: 0` for every expected state that does not name a wait, so
 * emitting `0` would put a five-second wait on every checked condition of every
 * successful attempt. One millisecond survives the guard and, because
 * `evaluateAssertion` always judges once before consulting its deadline, means
 * exactly what `0` was meant to mean: check now.
 */
const IMMEDIATE_TIMEOUT_MS = 1;

/** How much of a claim's text may reach a message or a failure record's `expected`. */
const MAX_DESCRIPTION_LENGTH = 160;

/**
 * The condition a raw expected-state entry names, or `undefined` when it names
 * none. `fallbackTimeoutMs` is Core's own wait budget for the expectation, used
 * only when the condition does not name its own.
 */
export function webAutomationExpectationCondition(value: JsonValue, fallbackTimeoutMs: number): WebAutomationExpectationCondition | undefined {
  const entry = jsonObject(value);
  if (!entry) return undefined;
  const nested = jsonObject(entry.assert);
  const claim = nested && isAssertKind(nested.kind) ? nested : entry;
  const kind = claim.kind;
  if (!isAssertKind(kind)) return undefined;
  const expected = typeof claim.expected === "string" ? claim.expected : undefined;
  const selector = nonEmptyString(entry.selector) ?? nonEmptyString(claim.selector);
  const timeoutMs = Math.max(
    IMMEDIATE_TIMEOUT_MS,
    positiveInteger(claim.timeoutMs) ?? positiveInteger(entry.timeoutMs) ?? nonNegativeInteger(fallbackTimeoutMs) ?? 0
  );
  const frameId = nonNegativeInteger(entry.frameId ?? entry.browserFrameId);
  const tabId = nonNegativeInteger(entry.tabId ?? entry.browserTabId);
  return {
    assert: { kind, ...(expected === undefined ? {} : { expected }), timeoutMs },
    ...(selector === undefined ? {} : { selector }),
    ...(frameId === undefined ? {} : { frameId }),
    ...(tabId === undefined ? {} : { tabId })
  };
}

/**
 * The `web.dom.assert` action parameters for a condition. The frame and tab
 * travel under the names `gateway-action-parameters.ts` reads
 * (`browserFrameId`, `browserTabId`), so a condition about a child frame is
 * judged in that frame rather than in the top document.
 */
export function webAutomationExpectationActionPayload(condition: WebAutomationExpectationCondition): JsonObject {
  return {
    ...(condition.selector === undefined ? {} : { selector: condition.selector }),
    ...(condition.frameId === undefined ? {} : { browserFrameId: condition.frameId }),
    ...(condition.tabId === undefined ? {} : { browserTabId: condition.tabId }),
    assert: {
      kind: condition.assert.kind,
      ...(condition.assert.expected === undefined ? {} : { expected: condition.assert.expected }),
      timeoutMs: condition.assert.timeoutMs
    }
  };
}

/**
 * The claim in words, for a failure record's `expected` and for the message a
 * rejected expectation carries. It describes the claim, never the page, so
 * nothing read off the document can leak through this path.
 */
export function describeWebAutomationExpectationCondition(condition: WebAutomationExpectationCondition): string {
  const where = condition.selector ? `"${condition.selector}"` : "the resolved element";
  const kind = condition.assert.kind;
  const expected = condition.assert.expected ?? "";
  if (kind === "url") return bounded(`the page URL contains "${expected}"`);
  if (kind === "text") return bounded(`${condition.selector ? where : "the page"} contains "${expected}"`);
  if (kind === "exists") return bounded(`an element matches ${where}`);
  if (kind === "absent") return bounded(`no element matches ${where}`);
  return bounded(`${where} is ${kind}`);
}

function isAssertKind(value: unknown): value is WebAutomationAssertKind {
  return typeof value === "string" && Object.hasOwn(ASSERT_KINDS, value);
}

function jsonObject(value: unknown): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function nonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function bounded(value: string): string {
  const collapsed = value.replace(/\s+/gu, " ").trim();
  return collapsed.length <= MAX_DESCRIPTION_LENGTH ? collapsed : `${collapsed.slice(0, MAX_DESCRIPTION_LENGTH - 1)}…`;
}
