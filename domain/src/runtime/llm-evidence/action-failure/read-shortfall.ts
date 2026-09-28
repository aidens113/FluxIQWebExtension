// Why a read came back with less than it was asked for, in this domain's own
// closed words, read off the account the page already sends.
//
// **The defect this closes.** `web.dom.extract_list` reports its own reading in
// full: how many records it returned, how many items its selector matched, how
// many of the returned records were empty, which declared fields some record
// lacked, whether the list ever appeared, and what ended the wait for it
// (`actions/extraction/summary.ts`, produced by
// `apps/extension/src/content/actions/extract-list.ts`). All of it arrives on
// the gateway result. None of it reached the model: a failed action became
// `webActionFailureRejectionCode(result)` and a `detail` hard-coded
// `undefined`, and the code itself fell through to the undifferentiated word
// `action_failed`.
//
// Measured on `run-mulryg6h-ff241a12`, 2026-09-28. The build explored the site
// competently for thirteen decisions, then ran the extraction its instruction
// needed and was told `web.action.rejected.action_failed` with 6,149 bytes of
// evidence. It tried again with a changed argument and got the same 6,149
// bytes, byte-for-byte. It tried a third time and got them again. With nothing
// to correct it could not put a record-producing step in its draft, Core's
// answerability check refused all three completion attempts, and the build ran
// out its 26 iterations with no Flow. Which shortfall it actually was is not
// recoverable from that bundle, because nothing published it.
//
// **What may be said.** Only what the summary already carries, which is counts,
// one closed word, and the call's own declared field keys -- the same rule
// `structure/refusal.ts` reads a detection's refusal under, applied to a read.
// Nothing here reads a value, a selector or a word of the page, and the summary
// itself is copied field by field by a reader that drops the whole of it rather
// than admit anything undeclared.
//
// **Nothing is diagnosed that the page did not already diagnose.** Each reason
// below is one branch of a fact the summary states outright; what this adds is
// routing, not judgement.

import type { JsonObject } from "fluxiq/core";
import { webAutomationExtractionSummaryValue, type WebAutomationExtractionSummary } from "../../../actions/extraction";
import type { WebLlmToolRejectionReason } from "../tool-rejection";

/** What a read that fell short came back with, and which shortfall it was. */
export type WebActionReadShortfall = {
  reason: WebLlmToolRejectionReason;
  recordsRead: number;
  itemsSeen: number | undefined;
  emptyRecords: number | undefined;
  missingFields: readonly string[] | undefined;
  waitStoppedOn: string | undefined;
};

/**
 * The read's own account of why it fell short, or nothing at all for a result
 * that carried none -- which is every action that is not a list read, and a
 * list read from a client build that predates the summary.
 *
 * Absence is the honest answer there rather than a guess: a refusal that
 * invented counts for an action that never counted anything would be worse than
 * the bare code it replaces.
 */
export function webActionReadShortfall(payload: JsonObject | undefined): WebActionReadShortfall | undefined {
  const summary = webAutomationExtractionSummaryValue(payload?.extraction);
  if (summary === undefined) return undefined;
  return {
    reason: whyTheReadFellShort(summary),
    recordsRead: summary.recordCount,
    itemsSeen: summary.itemsSeen,
    emptyRecords: summary.emptyRecords,
    missingFields: summary.missingFields,
    waitStoppedOn: summary.listWait?.stoppedOn
  };
}

/**
 * Which of the seven shortfalls this read was.
 *
 * The order is the order the repairs have to happen in, not the order the
 * fields are declared in. A selector that named nothing is decided first,
 * because every other answer would be a statement about rows that were never
 * there and the move it implies -- detect the list again -- has to happen
 * before any of the others could. The conditions come next, because a read that
 * its own `where` emptied says nothing about the page. Then the wait, then the
 * shape of what came back.
 */
function whyTheReadFellShort(summary: WebAutomationExtractionSummary): WebLlmToolRejectionReason {
  // The page's own word for it, and, where an older client build sends none,
  // the count that means the same thing: nothing matched, on any page read.
  if (summary.listPresence === "never_appeared") return "list_never_appeared";
  if (summary.listPresence === undefined && summary.itemsSeen === 0) return "list_never_appeared";
  const conditions = summary.conditions;
  if (conditions !== undefined && conditions.applied > 0 && conditions.kept === 0) return "conditions_kept_nothing";
  if (summary.recordCount === 0) {
    // A wait that ended on anything but the list arriving, with nothing read,
    // is the 2026-09-25 regression's own shape and the one a late page still
    // produces. `list_present` beside zero records is not that: the list came
    // and held nothing the read could keep.
    return summary.listWait !== undefined && summary.listWait.stoppedOn !== "list_present"
      ? "list_did_not_finish_loading"
      : "no_records_read";
  }
  // Rows found and every one of them empty: the selector named the list and the
  // fields are being read off the wrong element inside it.
  if (summary.emptyRecords !== undefined && summary.emptyRecords === summary.recordCount) return "records_have_no_fields";
  if (summary.missingFields.length > 0) return "required_fields_missing";
  // Rows, whole, and not enough of them -- which is the only shortfall left
  // once the post-condition failed and nothing above explains it.
  return "fewer_records_than_required";
}
