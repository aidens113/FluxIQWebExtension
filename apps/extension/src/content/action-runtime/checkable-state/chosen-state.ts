// Whether a control that is not a checkbox or radio is chosen, read from what
// the page shows (t364).
//
// Lane A round 5 (`run-muz0f12h-eae63685`) stopped on a colour swatch: a
// `<div>` the page arrives with already chosen, drawn with a darker border and
// nothing else. `web.dom.check` refused it as not a checkbox, and a click
// toggled it off, so no step could say "Space Grey, chosen" and be right
// however the page arrived. The page view already printed it `marked`, so the
// state was readable all along; the verb now reads it by the same rules.
//
// The signals, in order, each only when the page states it:
//
// - `aria-checked` (`true`, `false`; `mixed` reads as not chosen), the state of
//   a page's own checkbox, switch or radio;
// - `aria-pressed`, a toggle button's;
// - `aria-selected`, a tab's or a listbox option's;
// - drawn apart from the like options beside it, the rule the snapshot marks
//   by (`../../evidence/like-options.ts`): chosen when it is the one member of its
//   run drawn apart, not chosen when another member is or none is. A run with
//   two members drawn apart -- a banner's ghost and primary buttons -- says
//   nothing about which is chosen, so it is no reading at all.
//
// **Clearing** is meaningful where a press un-chooses: a page's checkbox or
// switch, a toggle button, and a drawn-apart option (a shop whose chosen chip a
// second press clears; the read-back after the press says whether it did). A
// radio and an `aria-selected` tab or option are cleared only by choosing
// another, so a request to clear one names the wrong control.

import { likeOptions } from "../../evidence";

/** A chosen state the page shows, what showed it, and whether a press can clear it. */
export type ChosenStateReading = { chosen: boolean; shownBy: string; clearable: boolean };

const RADIO_ROLES = new Set(["radio", "menuitemradio"]);

/** The control's chosen state, or `undefined` when the page shows none. */
export function readChosenState(element: Element): ChosenStateReading | undefined {
  const checked = ariaState(element, "aria-checked");
  if (checked !== undefined) return { chosen: checked, shownBy: "aria-checked", clearable: !RADIO_ROLES.has(role(element)) };
  const pressed = ariaState(element, "aria-pressed");
  if (pressed !== undefined) return { chosen: pressed, shownBy: "aria-pressed", clearable: true };
  const selected = ariaState(element, "aria-selected");
  if (selected !== undefined) return { chosen: selected, shownBy: "aria-selected", clearable: false };
  const options = likeOptions(element);
  if (options === undefined || options.apart.length > 1) return undefined;
  return { chosen: options.apart[0] === element, shownBy: "drawn apart from the like options beside it", clearable: true };
}

function ariaState(element: Element, name: string): boolean | undefined {
  const value = element.getAttribute(name)?.trim().toLowerCase();
  if (value === "true") return true;
  return value === "false" || value === "mixed" ? false : undefined;
}

function role(element: Element): string {
  return element.getAttribute("role")?.trim().toLowerCase() ?? "";
}
