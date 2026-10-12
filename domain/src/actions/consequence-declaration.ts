// Which web actions must say what they would lastingly do: the domain's one
// rule (t439).
//
// A press is the one web act whose effect the page decides rather than the
// action -- the same click applies a filter on one page and places an order on
// the next -- so a press, a key press and a dialog answer must carry a
// consequence declaration (`[]` for none), and so must a typing step that
// submits its form. Entering text that nothing submits, choosing, ticking,
// arriving at an address, scrolling and reading are not consequences at all
// (Core's `action-permissions/consequences.ts`), and need none.
//
// Every reader takes it from here: the plan-time and live `run_node` gate
// (`runtime/llm-evidence/plan-resolution/step-permission.ts`), and Core,
// through each output node's definition metadata
// (`output-nodes/definitions.ts`, Core's `consequenceDeclaration` key). Core
// schedules a saved step that need not declare to run as saved in a repair's
// test, and never one that must and did not: that step would reach the page
// without the permission gate having been asked (supervisor review, t439).
//
// A total record, so a verb added later does not compile until somebody has
// decided whether it commits.

import type { JsonObject } from "fluxiq/core";
import type { WebAutomationActionType } from "./types";

/** Core's shape: always, never, or only when the named boolean parameter is `true`. */
export type WebAutomationConsequenceDeclaration = "required" | "not_required" | { requiredWhen: string };

/** The rule, verb by verb. */
export const WEB_AUTOMATION_ACTION_CONSEQUENCE_DECLARATION: Readonly<Record<WebAutomationActionType, WebAutomationConsequenceDeclaration>> = Object.freeze({
  "web.browser.navigate": "not_required",
  "web.browser.download": "not_required",
  "web.browser.tab": "not_required",
  "web.dom.click": "required",
  "web.dom.type": Object.freeze({ requiredWhen: "submit" }),
  "web.dom.clear": "not_required",
  "web.dom.select": "not_required",
  "web.dom.keypress": "required",
  "web.dom.check": "not_required",
  "web.dom.upload": "not_required",
  "web.dom.dialog": "required",
  "web.dom.scroll": "not_required",
  "web.dom.wait_for_selector": "not_required",
  "web.dom.wait_for_text": "not_required",
  "web.dom.extract": "not_required",
  "web.dom.extract_list": "not_required",
  "web.dom.next_page": "not_required",
  "web.dom.capture_snapshot": "not_required",
  "web.dom.assert": "not_required"
});

/** Whether a step running this action with these parameters must declare its consequences. */
export function webAutomationActionDeclarationRequired(actionType: WebAutomationActionType, parameters: JsonObject | undefined): boolean {
  const rule = WEB_AUTOMATION_ACTION_CONSEQUENCE_DECLARATION[actionType];
  if (rule === "required" || rule === "not_required") return rule === "required";
  return parameters?.[rule.requiredWhen] === true;
}
