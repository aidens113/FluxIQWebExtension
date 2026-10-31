import type { AutomationStudioNodeActionEffect } from "fluxiq/automation-studio/action-effect";
import type { WebAutomationActionType } from "../types";

/** Trusted verb floors, independent of permission-declaration requirements.
 * Generic presses have page-defined effects; downloads, tab operations and
 * Next cannot safely repeat after a lost acknowledgement. No verb alone
 * establishes a money, deletion or publication consequence. Scroll retains
 * the existing repeat-safe observation promise used by the web runtime.
 * Only inspected state setters promise repeat safety: typing replaces the
 * whole field before sending characters; checking reads the requested state
 * and skips an already-set control; clear assigns the empty value; select
 * assigns the matched option index; ordinary navigation drives the same tab
 * to its requested address. Submitting text or forcing a new tab commits.
 * A declared lasting consequence still outranks the state-setter promise.
 */
export const WEB_AUTOMATION_NODE_ACTION_EFFECT: Readonly<Record<WebAutomationActionType, AutomationStudioNodeActionEffect>> = Object.freeze({
  "web.browser.navigate": Object.freeze({ effectClass: "state", commitWhen: "newTab", repeatSafe: true }),
  "web.browser.download": Object.freeze({ effectClass: "commit" }),
  "web.browser.tab": Object.freeze({ effectClass: "commit" }),
  "web.dom.click": Object.freeze({ effectClass: "commit" }),
  "web.dom.type": Object.freeze({ effectClass: "state", commitWhen: "submit", repeatSafe: true }),
  "web.dom.clear": Object.freeze({ effectClass: "state", repeatSafe: true }),
  "web.dom.select": Object.freeze({ effectClass: "state", repeatSafe: true }),
  "web.dom.keypress": Object.freeze({ effectClass: "commit" }),
  "web.dom.check": Object.freeze({ effectClass: "state", repeatSafe: true }),
  "web.dom.upload": Object.freeze({ effectClass: "state" }),
  "web.dom.dialog": Object.freeze({ effectClass: "commit" }),
  "web.dom.scroll": Object.freeze({ effectClass: "observe" }),
  "web.dom.wait_for_selector": Object.freeze({ effectClass: "observe" }),
  "web.dom.wait_for_text": Object.freeze({ effectClass: "observe" }),
  "web.dom.extract": Object.freeze({ effectClass: "observe" }),
  "web.dom.extract_list": Object.freeze({ effectClass: "observe" }),
  "web.dom.next_page": Object.freeze({ effectClass: "commit" }),
  "web.dom.capture_snapshot": Object.freeze({ effectClass: "observe" }),
  "web.dom.assert": Object.freeze({ effectClass: "observe" })
});
