// What a recorded web call does to the state, from the domain's own safety table:
// an action marked `safe` only observes or waits, so it is a read. Navigating and
// moving a list to its next page move the page, and only navigating names where it
// goes. Everything else acts on the page, scrolls included, because a scroll may
// load more. An action the table does not know is an act, the costly side to be
// wrong on, except the page-facts read Core's own trial asks for.

import { WEB_AUTOMATION_ACTION_SAFETY } from "../../../actions/safety";

const PAGE_FACTS = "web.page.facts";

export type WebTraceStateCallKind = "read" | "page_move" | "act";

export function webTraceStateCallKind(actionType: string): WebTraceStateCallKind {
  if (actionType === "web.browser.navigate" || actionType === "web.dom.next_page") return "page_move";
  if (actionType === PAGE_FACTS) return "read";
  return Object.hasOwn(WEB_AUTOMATION_ACTION_SAFETY, actionType) && WEB_AUTOMATION_ACTION_SAFETY[actionType as keyof typeof WEB_AUTOMATION_ACTION_SAFETY] === "safe" ? "read" : "act";
}

export function webTraceStatePageMoveForm(actionType: string): "absolute" | "relative" {
  return actionType === "web.browser.navigate" ? "absolute" : "relative";
}
