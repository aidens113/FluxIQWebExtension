// The refusal of a text field whose own visible disclosure still hides its
// remainder. Reading never presses a control here; a list read, unless it says
// `discloseText: false` (`read-disclosing.ts`), presses the one this refusal
// names and reads again, so a refusal that reaches the author means that press
// could not open the text, or the control was one never pressed.
//
// So the repair it names is narrowing the read: leave the field out, or narrow
// the conditions so the row is not kept. Until t752 (2026-10-20) it prescribed a
// two-read shape -- a row-context read, an optional row-bound press repeated over
// it, then the full read -- which builds got wrong in three rounds running, and
// whose unconditioned context read pressed every row of a long list one model
// step at a time until a build ran out of time; t752's first unit named
// `discloseText: true`, which its unit C2 made the default.

import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "@fluxiq-web-extension/domain/client";
import { textDisclosureControl } from "./disclosure-control";
import { REFUSED_DISCLOSURE_CONTROLS } from "./refused-controls";

/** Refuse a text field whose own visible disclosure still hides its remainder. */
export function assertTextDisclosed(element: Element, name: string): void {
  const control = textDisclosureControl(element);
  if (!control) return;
  const expected = `field ${name} contains fully disclosed text`;
  const actual = `incomplete_text: field ${name} contains unexpanded text; the read presses each kept row's own disclosure control itself (unless discloseText: false), and this row's did not open its text or is a link or form button, so it cannot be read whole: leave this field out, or narrow the conditions so this row is not kept`;
  const refusal = Object.assign(new Error(actual), {
    failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED, { expected, actual })
  });
  REFUSED_DISCLOSURE_CONTROLS.set(refusal, control);
  throw refusal;
}
