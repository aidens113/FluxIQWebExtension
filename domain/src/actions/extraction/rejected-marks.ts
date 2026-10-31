// What a list read's client found on an item it left out, beside the item's
// rejected row (t810, framework plan P5b).
//
// A judge that says a left-out row "was asked for" -- a feed's suggested post
// "from a group the person belongs to" -- has only the row's cells to be held
// to. The post carries a `Join group` button the person never pressed: the
// page offers to bring the person into the post's group, so the person is
// outside it. The extension reads that control on the item
// (`apps/extension/src/content/extraction/item-offer/`) and sends it as an
// `outside` mark: `said` the control's words as the page shows them, `entity`
// the linked name beside it where that is clear. The words are the client's
// alone; Core keeps only this shape (`AutomationStudioResultItemMark`).
//
// **Positional, like the observations**: `rejectedMarks[condition][row]` is the
// marks on `rejectedSamples[condition][row]`, `null` where the item offers
// nothing. **A malformed member costs the marks, not the summary**: marks only
// add evidence, so the summary keeps its rows and counts when they are unreadable
// (`summary.ts`; Core's `extraction-summary.ts` does the same).

import type { WebAutomationExtractionSummary } from "./summary";

/** The summary member that carries the marks: one name for the page, the domain and the node run. */
export const WEB_AUTOMATION_EXTRACT_REJECTED_MARKS_KEY = "rejectedMarks" satisfies keyof WebAutomationExtractionSummary;

/** One thing the page offers on an item that places the person outside the item's set. */
export type WebAutomationExtractionItemMark = { kind: "outside"; said: string; entity?: string };

/** Per condition, per rejected row, the marks on that item or `null`. */
export type WebAutomationExtractionRejectedMarks = Array<Array<WebAutomationExtractionItemMark[] | null>>;

/** The marks copied, aligned with `samples`, or `undefined` for anything that is not exactly that. */
export function webAutomationExtractionRejectedMarksValue(value: unknown, samples: readonly (readonly unknown[])[]): WebAutomationExtractionRejectedMarks | undefined {
  if (!Array.isArray(value) || value.length !== samples.length) return undefined;
  const out: WebAutomationExtractionRejectedMarks = [];
  for (const [index, entries] of value.entries()) {
    if (!Array.isArray(entries) || entries.length !== samples[index]?.length) return undefined;
    const list: Array<WebAutomationExtractionItemMark[] | null> = [];
    for (const entry of entries) {
      if (entry === null) {
        list.push(null);
        continue;
      }
      if (!Array.isArray(entry) || entry.length === 0) return undefined;
      const marks: WebAutomationExtractionItemMark[] = [];
      for (const mark of entry) {
        const copied = markValue(mark);
        if (copied === undefined) return undefined;
        marks.push(copied);
      }
      list.push(marks);
    }
    out.push(list);
  }
  return out;
}

function markValue(value: unknown): WebAutomationExtractionItemMark | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const mark = value as Record<string, unknown>;
  if (mark.kind !== "outside" || typeof mark.said !== "string" || mark.said.trim() === "") return undefined;
  if (Object.keys(mark).some((key) => key !== "kind" && key !== "said" && key !== "entity")) return undefined;
  if (mark.entity !== undefined && (typeof mark.entity !== "string" || mark.entity.trim() === "")) return undefined;
  return { kind: "outside", said: mark.said, ...(mark.entity === undefined ? {} : { entity: mark.entity }) };
}
