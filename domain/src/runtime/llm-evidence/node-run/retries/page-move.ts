// Whether a page moved the way a list turning its page moves it, from the page
// an act found and the page it left (t1096). Split out of `./page-effect.ts`,
// which asks it of a lasting act whose answer was lost, so the run can ask the
// same of a press on a list's Next whose answer came back (`../run.ts`).
//
// Three things move when a list turns its page:
//
//  - the address, query kept (`?page=2` is a move);
//  - which controls the page marks current (`aria-current`, as a pager marks its page);
//  - the identity of the first row the page places in a record (row, card,
//    list item), by the key or words the capture gave it.
//
// `landed` when any of the three moved. `not_landed` only for a page turn, and
// only when nothing moved: the same address, the same marks, and the same rows
// in the same order, at least one of them, which is the Next page verb's own
// definition of failure (`list_unchanged`). Anything else is `unknown`: no
// change does not prove a plain press did not land.
//
// Nothing of either page leaves here but the verdict.

import type { WebLlmEvidenceElement } from "../../elements";
import { attributeValue, webLlmElementWords } from "../../page-view";
import type { WebLlmSnapshotBinding } from "../../sanitize";

/** The verdict of the two pages (header). `pageTurn`: the act turns a list's page, so an unchanged list says it did not. */
export function webNodePageMove(found: WebLlmSnapshotBinding, after: WebLlmSnapshotBinding, pageTurn: boolean): "landed" | "not_landed" | "unknown" {
  const marks = { found: currentMarks(found), after: currentMarks(after) };
  const rows = { found: recordRows(found), after: recordRows(after) };
  if (found.evidence.location !== after.evidence.location) return "landed";
  if (marks.found.length > 0 && marks.after.length > 0 && !sameList(marks.found, marks.after)) return "landed";
  if (rows.found.length > 0 && rows.after.length > 0 && rows.found[0] !== rows.after[0]) return "landed";
  if (!pageTurn) return "unknown";
  return rows.found.length > 0 && sameList(rows.found, rows.after) && sameList(marks.found, marks.after) ? "not_landed" : "unknown";
}

/** The words of every rendered control the page marks current, in page order. */
function currentMarks(page: WebLlmSnapshotBinding): string[] {
  return rendered(page).filter(markedCurrent).map((element) => webLlmElementWords(element) ?? "");
}

/** As the page view's `current` token reads it (`../../page-view/element/state-tokens.ts`). */
function markedCurrent(element: WebLlmEvidenceElement): boolean {
  const current = attributeValue(element, "aria-current")?.trim().toLowerCase();
  return current !== undefined && current !== "" && current !== "false";
}

/** The records the page placed its rendered elements in, in page order, each once where it repeats in a row. */
function recordRows(page: WebLlmSnapshotBinding): string[] {
  const rows: string[] = [];
  for (const element of rendered(page)) {
    const row = page.records.get(element.target);
    if (row !== undefined && row !== rows[rows.length - 1]) rows.push(row);
  }
  return rows;
}

/** Only what a person sees: a look that also listed hidden elements is compared on the same footing as one that did not. */
function rendered(page: WebLlmSnapshotBinding): WebLlmEvidenceElement[] {
  return page.evidence.elements.filter((element) => element.hidden !== true);
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((entry, index) => entry === b[index]);
}
