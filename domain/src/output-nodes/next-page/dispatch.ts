// What a `web.dom.next_page` node dispatches, or why it refuses to.
//
// **The request is checked before anything is sent.** A `nextPage` that does
// not parse -- an empty selector, an unknown key, a read's `maxPages` copied
// onto a step that moves one page, or the model's handle form left unresolved
// -- is a fault in the Flow rather than in the page, and the same parameters
// will not parse differently next time. So the node fails with
// `graph_validation_or_unknown_node` at the `dispatch` stage, not retryable,
// exactly as the list extraction refuses a record output it could not save
// (`../extract-list/dispatch.ts`), and nothing reaches the browser.
//
// **The timeout is the dispatch's own, not only the page's.** Core gives a
// command the time its dispatch payload's `timeoutMs` names and otherwise the
// gateway's default; the list extraction learned that a timeout sent only in
// `parameters` lets the page keep working after Core stopped waiting. The
// node's timeout -- the authored one, or the default when the author left it --
// is sent in both places.

import type { AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import type { AutomationNodeExecutionResult } from "fluxiq/automation-studio/nodes";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationNextPageRequestValue } from "../../actions/next-page";
import { WEB_AUTOMATION_NEXT_PAGE_TIMEOUT_MS } from "./parameters";

/** The dispatch payload's fields beside `outputId`, or the node's refusal when its request does not parse. */
export type WebAutomationNextPageDispatch =
  | { ok: true; payload: JsonObject }
  | { ok: false; result: AutomationNodeExecutionResult };

export function webAutomationNextPageDispatch(nodeParameters: JsonObject): WebAutomationNextPageDispatch {
  if (webAutomationNextPageRequestValue(nodeParameters.nextPage) === undefined) return { ok: false, result: invalidRequest() };
  const timeoutMs = positiveTimeout(nodeParameters.timeoutMs) ?? WEB_AUTOMATION_NEXT_PAGE_TIMEOUT_MS;
  return { ok: true, payload: { parameters: { ...nodeParameters, timeoutMs }, timeoutMs } };
}

function positiveTimeout(value: JsonValue | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function invalidRequest(): AutomationNodeExecutionResult {
  const code = "web.next_page.invalid_request";
  const failure: AutomationStudioFailureRecord = {
    category: "graph_validation_or_unknown_node",
    code,
    retryable: false,
    stage: "dispatch",
    expected: "nextPage naming the list's item selector and, optionally, one way to its next page with no page bound",
    actual: "nextPage is missing or is not such a request, so nothing was sent to the browser"
  };
  return {
    status: "failed",
    route: "failed",
    effects: [],
    outputs: { error: { code } },
    message: "Next page is not a valid request, so the page was not moved.",
    failure
  };
}
