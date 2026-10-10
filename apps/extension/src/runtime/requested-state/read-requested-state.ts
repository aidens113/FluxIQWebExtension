// Whether a state-setting action's requested state holds on the document its
// page navigated to (t407).
//
// A check or a choice whose page reloads as it is set -- bigbox's rating facet
// is a checkbox that submits its filter form -- takes the content script's
// document away before the verb can answer, and the worker is left with
// "message channel closed" (`click-landing.ts`). Until t407 that was a failed
// step every time: the retry then read "already set", so each such facet cost
// a retry and a false failure in the trace and the chat. A check or a choice
// declares a state, so the honest answer after a lost reply is not to set it
// again but to read whether the state now holds, and this module is that read.
//
// The read is the fact check's own (`../fact-check-runner.ts`, judged by
// `content/facts/judge.ts`), so the page answers with the rules a fact
// condition is answered with: a checkbox, a radio, or a control that shows its
// own chosen state (t364) by `checked`; a select by `value`, which the page
// matches against the select's value and its chosen option's label. Three
// answers come back:
//
//  - `landed`: the requested state holds on the new document.
//  - `not_landed`: the control is there and does not hold it, read for the
//    whole of the budget, since a page that draws its filters after it loads
//    can show the old state for a moment.
//  - `unknown`: nothing could say -- the control is not on the new page, the
//    page would not answer, the control is sensitive, or the request names
//    something the page cannot be asked about (an option by index).
//
// Nothing here quotes the control's value or the option asked for: a select
// may be sensitive, and the record names only what kind of state was asked.

import type { WebAutomationFactAnswer, WebAutomationFactQuery, WebAutomationFactTarget } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand } from "../../shared/protocol";
import { runFactCheck } from "../fact-check-runner";
import type { LandedTabAccess } from "../landed-check-wait";

/** How long the new document is asked, again and again, before its last answer stands. */
const STATE_READ_MS = 2_500;

/** How long between asking a document whose answer was not yet `true`. */
const STATE_READ_RETRY_MS = 150;

/** What the new document says about the requested state, and the words a record says it in. */
export type RequestedStateReading =
  | { kind: "landed"; actual: string }
  | { kind: "not_landed"; actual: string }
  | { kind: "unknown"; actual: string };

/**
 * Reads, on the tab's top document, whether the state `action` asked for
 * holds: once the tab has settled, and then again every STATE_READ_RETRY_MS
 * until it does or `budgetMs` has passed.
 */
export async function readRequestedState(
  action: BrowserActionCommand,
  tabId: number,
  access: LandedTabAccess,
  budgetMs = STATE_READ_MS
): Promise<RequestedStateReading> {
  const asked = requestedStateQuery(action);
  if ("unaskable" in asked) return { kind: "unknown", actual: asked.unaskable };
  await access.settle(tabId);
  const deadline = Date.now() + budgetMs;
  for (;;) {
    const answer = (await runFactCheck({ queries: [asked.query] }, { tabId, send: access.send })).answers[0];
    if (answer?.result === "true") return { kind: "landed", actual: `on the page it landed on ${asked.subject} ${asked.state}` };
    if (Date.now() + STATE_READ_RETRY_MS >= deadline) return lastReading(answer, asked);
    await new Promise<void>((resolve) => setTimeout(resolve, STATE_READ_RETRY_MS));
  }
}

/** The claim to ask the page, with the words its answer is said in; or why the page cannot be asked. */
type AskedState = { query: WebAutomationFactQuery; subject: string; state: string; notState: string } | { unaskable: string };

function requestedStateQuery(action: BrowserActionCommand): AskedState {
  const target = factTarget(action);
  if (target === undefined) return { unaskable: "the action names no element the page it landed on can be asked about" };
  if (action.actionType === "web.dom.check") {
    const requested = action.checked ?? true;
    return {
      query: { kind: "checked", target, expected: requested },
      subject: "the control is",
      state: requested ? "checked" : "unchecked",
      notState: requested ? "unchecked" : "checked"
    };
  }
  if (action.actionType === "web.dom.select") {
    const named = action.option ?? (action.value !== undefined ? { by: "value" as const, value: action.value } : undefined);
    if (named === undefined) return { unaskable: "the action names no option" };
    if (named.by === "index") return { unaskable: "the option is named by its position, which the page it landed on cannot be asked about" };
    const expected = named.by === "value" ? named.value : named.label;
    return {
      query: { kind: "value", target, comparison: "equals", expected },
      subject: "the select",
      state: "holds the requested option",
      notState: "holds another option"
    };
  }
  return { unaskable: `${action.actionType} sets no state the page it landed on can be asked about` };
}

/** The recorded element's identity and selector, as the action's own resolver reads them. */
function factTarget(action: BrowserActionCommand): WebAutomationFactTarget | undefined {
  const element = describedElement(action.element) ?? describedElement(action.options?.element);
  if (element === undefined && !action.selector) return undefined;
  return {
    ...(action.selector ? { selector: action.selector } : {}),
    ...(element !== undefined ? { element } : {})
  };
}

/** A wire value that is an element description: an object carrying at least one signal. */
function describedElement(value: unknown): WebAutomationFactTarget["element"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return Object.keys(value).length ? value as WebAutomationFactTarget["element"] : undefined;
}

/**
 * The answer the budget ended on. `false` about an element the page described
 * is the state not holding; `false` with no element is the control missing
 * from the new page, which says nothing about whether the state was set.
 */
function lastReading(answer: WebAutomationFactAnswer | undefined, asked: Extract<AskedState, { query: unknown }>): RequestedStateReading {
  if (answer?.result === "false" && answer.evidence?.element !== undefined) return { kind: "not_landed", actual: `on the page it landed on ${asked.subject} ${asked.notState}` };
  if (answer?.result === "false") return { kind: "unknown", actual: "the control is not on the page it landed on" };
  const reason = answer?.evidence?.reason;
  return { kind: "unknown", actual: `the page it landed on could not say whether ${asked.subject} ${asked.state}${reason ? ` (${reason})` : ""}` };
}
