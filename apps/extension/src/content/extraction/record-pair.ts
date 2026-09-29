// When two siblings are a list.
//
// Three siblings of one template is what this directory calls a run rather
// than a coincidence (`infer-list.ts`), and two was never enough. That left
// every two-item list on the web undetectable, however plainly it was one, and
// the most ordinary of them is a shopping cart: after the everything store's
// task moves the phone case to Saved for later, the cart holds two lines, and
// structure detection refused every element on the page -- the lines
// themselves included -- as `no_repeating_run`. A live build spent a dozen
// decisions asking again and produced no Flow (`run-mulum3x7-18ceeb75`,
// `docs/working/language-driven-flow-loop-plan/reports/cart-extraction.md`).
//
// Two of anything is a coincidence far more often than three, so a pair must
// show it is a pair of records, and each test is structural, never a value:
// - the template is named: the items share a class, a role or a test id, not
//   merely a tag -- two bare `<p>`s in a row are prose;
// - each item is a container, not a leaf: a record holds its values;
// - each item holds at least two values of its own, in both items
//   (`content-fields.ts`), which a pair of layout columns or of buttons does not.
//
// Runs of three or more are unchanged; this only admits pairs.

import type { WebAutomationExtractionProposalField } from "@fluxiq-web-extension/domain/client";
import { testIdFor } from "../describe-element";
import { contentFieldCount } from "./content-fields";

/** The size of run this rule decides. */
const PAIR = 2;

/** Values of its own each item of a pair must hold, in both items. */
const MIN_PAIR_CONTENT_FIELDS = 2;

/**
 * Whether a two-item run is a list of records. Given no fields, only the
 * structural half is asked -- what a scan can decide before paying for an
 * inference -- and the fields are asked once the inference has them.
 */
export function isRecordPair(run: readonly Element[], fields?: readonly WebAutomationExtractionProposalField[]): boolean {
  if (run.length !== PAIR) return false;
  const [first] = run;
  if (!first || !namesItsTemplate(first)) return false;
  if (!run.every((item) => item.childElementCount > 0)) return false;
  return fields === undefined || contentFieldCount(fields, 1) >= MIN_PAIR_CONTENT_FIELDS;
}

function namesItsTemplate(element: Element): boolean {
  return element.classList.length > 0 || Boolean(element.getAttribute("role")?.trim()) || testIdFor(element) !== undefined;
}
