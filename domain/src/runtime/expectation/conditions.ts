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
//
// Reading a claim and being able to *ask* it are two different things, and this
// module answers both, separately. A claim can be perfectly well-formed JSON and
// still name nothing a page could be asked about -- a `url` claim with no URL in
// it, an `absent` claim with no element in it. Dispatching one of those does not
// produce "we could not tell"; it produces a confident wrong answer, because the
// content script judges what it was handed:
//
//   - `absent` with no selector is the dangerous one. `assertion-evaluation.ts`
//     resolves the target by re-querying the selector, finds nothing because
//     there was nothing to query, and reports the claim as *held* and *judged*.
//     "The blocking banner is gone" comes back yes without anything having been
//     looked at -- which is exactly the answer a recovery verdict must never be
//     given, since it is the one that says deterministic execution may resume.
//   - `url` with no expected URL, and `exists` with no element, are reported as
//     malformed, which reaches this domain as an ordinary rejection. The verdict
//     would then read "the page's URL is wrong" about a question nobody asked.
//   - `text` with a blank expected string holds on every page that has any text
//     at all, since `"anything".includes("")` is true.
//
// So `webAutomationExpectationConditionRefusal` names, before anything is
// dispatched, the claims this domain will not ask. `evaluate.ts` reports a
// refused claim as unjudged -- neither held nor rejected -- which is the only
// honest third answer and the one a required-evidence check reads as "not
// resumable".

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
 * What each claim must name before the page can be asked it, keyed by the same
 * exhaustive union as `ASSERT_KINDS` so a new kind has to declare its subject
 * rather than defaulting to "askable".
 *
 * `selector` -- the claim is about one element, and the payload this module
 * builds carries no other way to find one. `webAutomationExpectationActionPayload`
 * emits a selector, a frame and a tab and nothing else, so with no selector the
 * content script's `assertionTarget` falls through to `deps.resolveTarget`, which
 * has no coordinates, bounds or fingerprint to work from and leaves an empty
 * target. `text` is not in this group on purpose: with no selector it is the
 * authored claim "the page says X", judged against `document.body`, which is a
 * real question with a real answer.
 *
 * `expected` -- the claim is about a value, and without one there is nothing to
 * compare against.
 */
const CLAIM_SUBJECTS: Readonly<Record<WebAutomationAssertKind, { readonly selector: boolean; readonly expected: boolean }>> = Object.freeze({
  exists: { selector: true, expected: false },
  absent: { selector: true, expected: false },
  visible: { selector: true, expected: false },
  enabled: { selector: true, expected: false },
  text: { selector: false, expected: true },
  url: { selector: false, expected: true }
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

/**
 * Why this domain will not put the claim to the page, or `undefined` when it
 * will. The reason is phrased as the claim, not as the page, for the same reason
 * `describeWebAutomationExpectationCondition` is: it becomes a message, and
 * nothing read off the document may travel that way.
 *
 * This is a refusal to ask, never a verdict. A caller must report a refused
 * condition as unjudged: reporting it as held would answer a question nobody
 * asked with "yes", and reporting it as rejected would blame the page for a
 * claim that named no page.
 *
 * The check is deliberately here and not in `webAutomationExpectationCondition`,
 * which returns `undefined` for a shape this domain cannot read at all. A shape
 * that could not be read and a claim that could not be asked are both unjudged,
 * but they are different facts and each says so in its own words.
 */
export function webAutomationExpectationConditionRefusal(condition: WebAutomationExpectationCondition): string | undefined {
  const kind = condition.assert.kind;
  const subjects = CLAIM_SUBJECTS[kind];
  if (subjects.selector && condition.selector === undefined) {
    return bounded(`a ${kind} claim naming no element, which the page cannot be asked`);
  }
  // Blank counts as absent. A `url` claim of " " matches no address and would be
  // reported as the page being at the wrong one; a `text` claim of "" or " " is
  // satisfied by the text of very nearly every page, which is the same lie in
  // the other direction.
  if (subjects.expected && (condition.assert.expected ?? "").trim().length === 0) {
    return bounded(`a ${kind} claim naming nothing to look for, which the page cannot be asked`);
  }
  return undefined;
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
