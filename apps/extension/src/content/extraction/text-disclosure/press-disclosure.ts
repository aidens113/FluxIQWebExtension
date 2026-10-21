// Pressing one row's own text-disclosure control, for a list read that discloses
// text (every read unless `discloseText: false`, `read-disclosing.ts`), and
// waiting, bounded, for the text to open.
//
// Only a control the refusal recognised (`disclosure-control.ts`) inside the
// field it read is ever offered here, and this file refuses the ones whose
// press could do something other than open text: a control outside the row, a
// link to another page (an `a[href]`, or anything inside one), and a form's
// submit button. Pressed, a control has opened its text once it is gone from
// the row, says it is expanded, is hidden, or no longer reads as a disclosure
// ("See less"). A control that does none of that within the wait was still
// pressed; the read then finds the field still cut and refuses it as before.

import { textDisclosureControl } from "./disclosure-control";

/** How long one press is given to open its text, at most; a press that opens it at once is not waited on. */
const EXPANSION_WAIT_MS = 2_000;
const EXPANSION_POLL_MS = 50;

/**
 * Presses `control`, a collapsed disclosure inside `row`, and waits for it to
 * open, never past `deadline`. `false` without pressing for a control this
 * read never presses; `true` once pressed, opened or not.
 */
export async function pressTextDisclosure(row: Element, control: Element, deadline: number | undefined): Promise<boolean> {
  if (control === row || !row.contains(control) || leavesThePage(control)) return false;
  const press = (control as Partial<HTMLElement>).click;
  if (typeof press !== "function") return false;
  press.call(control);
  const until = Math.min(Date.now() + EXPANSION_WAIT_MS, deadline ?? Number.POSITIVE_INFINITY);
  while (!opened(row, control) && Date.now() < until) await new Promise((resolve) => setTimeout(resolve, EXPANSION_POLL_MS));
  return true;
}

/** Whether the pressed control no longer stands collapsed in its row. */
function opened(row: Element, control: Element): boolean {
  return !row.contains(control) || textDisclosureControl(control) !== control;
}

/** Whether pressing the control could navigate or submit: a link with a target, anything inside one, or a form's submit button. */
function leavesThePage(control: Element): boolean {
  let inForm = false;
  let inLink = false;
  for (let current: Element | null = control; current; current = current.parentElement) {
    if (current.tagName === "A" && current.hasAttribute("href")) inLink = true;
    if (current.tagName === "FORM") inForm = true;
  }
  const submits = control.tagName === "BUTTON" && (control.getAttribute("type") ?? "submit").toLowerCase() === "submit";
  return inLink || (submits && inForm);
}
