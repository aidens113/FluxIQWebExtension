// Whether an element is a stateful control a reset can read the state of (L1
// reset settlement, "Control states"): a visible button, checkbox, switch,
// radio, menu item that checks, option or tab by its role or the role its tag
// implies, or any visible element that states it is pressed, checked or
// selected. A hidden element is no control a person can press back.

import type { WebLlmEvidenceElement } from "../elements";
import { webControlRole } from "./role";

/** The roles whose elements hold a state of their own a press flips. */
const STATEFUL_ROLES: ReadonlySet<string> = new Set(["button", "checkbox", "switch", "radio", "menuitemcheckbox", "menuitemradio", "option", "tab"]);
/** The attributes by which any element states its own state. */
const STATE_ATTRIBUTES: ReadonlySet<string> = new Set(["aria-pressed", "aria-checked", "aria-selected"]);

/** Whether `element` is a visible stateful control (header). */
export function isWebStatefulControl(element: Pick<WebLlmEvidenceElement, "role" | "implicitRole" | "hidden" | "attributes">): boolean {
  if (element.hidden === true) return false;
  return STATEFUL_ROLES.has(webControlRole(element)) || (element.attributes ?? []).some(([name]) => STATE_ATTRIBUTES.has(name.toLowerCase()));
}
