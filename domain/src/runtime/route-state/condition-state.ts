// The route state as a Router's condition reads it (t869).
//
// `state.page.controls` carries the headings its controls fell under, so the
// model reading an evidence history knows which listings a "Results outside
// your search" heading covers (`./control-mark.ts`). A saved Flow's condition
// tests what the page offers: "Sold out" in the line must mean a control says
// so, never that a heading does. Core hands the observed state here before a
// condition reads it (`routeConditionState`), and this takes each mark off, so
// the line a condition reads is the bare names, as it was before headings.
// Every other key is returned as it is.

import type { JsonObject } from "fluxiq/core";
import { webRouteControlName } from "./control-mark";

const LIST_SEPARATOR = " | ";

export function webAutomationRouteConditionState(state: JsonObject): JsonObject {
  const page = state.page;
  if (typeof page !== "object" || page === null || Array.isArray(page)) return state;
  const controls = page.controls;
  if (typeof controls !== "string") return state;
  return { ...state, page: { ...page, controls: controls.split(LIST_SEPARATOR).map(webRouteControlName).join(LIST_SEPARATOR) } };
}
