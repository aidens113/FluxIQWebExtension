// What a press on an element reaches: the nearest control around it, itself
// included. A press lands on an element and its activation goes to the button,
// link or widget around it, so both the press guard (`../interference/press-guard/`)
// and the actionability gate (`../actionability.ts`) ask this one selector which
// control a point belongs to.

/** The controls a press is delivered to, as roles and elements a person presses. */
export const PRESSABLE_HOST = 'button, a[href], input, select, textarea, summary, [role="button"], [role="link"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"]';
