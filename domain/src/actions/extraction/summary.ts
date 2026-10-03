// The result half of `web.dom.extract_list` (contract C2): what a list read
// says about itself, beside the records it returns in `extracted`.
//
// Every value here is a count, a flag, a word from a closed set, or a declared
// field key. None is read from the page, which is what lets the wire payload
// carry the summary for any element. That holds only while the shape stays this
// way, so the copy below admits nothing else: a string that is not a
// well-formed field key, a word outside its set, or a missing field that is not
// one of the read's own fields, drops the whole summary rather than letting
// page text ride on a field nothing redacts. Two exceptions carry page text,
// uncut, and are screened where they become evidence: `rejectedSamples`, only
// when an exploring model's node run asks for every rejected row or a Flow's
// playback for the rows each condition removed by itself
// (`./rejected-samples.ts`), and `conditions.seen` (`./seen-values.ts`).

import { webAutomationExtractionConditionSeenValue, type WebAutomationExtractionConditionSeen } from "./seen-values";
import { isWebAutomationExtractFieldKey } from "./field-key";
import { webAutomationExtractionOrderReportValue, type WebAutomationExtractionOrderReport } from "./order-report";
import { webAutomationExtractionRejectedSamplesAloneValue, webAutomationExtractionRejectedSamplesValue, type WebAutomationExtractionRejectedRow } from "./rejected-samples";

export type WebAutomationExtractionSummary = {
  /** Records returned, across every page read. */
  recordCount: number;
  /** Pages read, the first included. */
  pagesRead: number;
  /**
   * Items the `item` selector matched, across every page read, before any
   * condition, any duplicate and the item bound (C2).
   *
   * It is the number that separates the two halves of a zero read. Six of the
   * ten Flows built on the everything-store rung stored **no records**, and from
   * the artifacts they are indistinguishable: `recordCount: 0` says the same
   * thing whether the selector named nothing, the page held nothing, every
   * column came back empty, or the conditions removed every row. `listPresence`
   * separates the first from the rest and cannot count, `conditions.applied`
   * counts but is absent from a read with no `where`, and this is the count
   * every read has. `itemsSeen: 0` is the selector; `itemsSeen` above
   * `recordCount` with no conditions is duplicates or the bound.
   *
   * Optional, because the producer is the page and a build that predates it
   * still sends a summary that arrives whole -- the rule `listPresence` was
   * added under. A page that sends it makes the distinction recordable; until
   * one does, this is the declaration that keeps it from being dropped on the
   * wire (`webAutomationExtractionSummaryValue` copies field by field, so an
   * undeclared count never survives the boundary).
   */
  itemsSeen?: number | undefined;
  /**
   * Records that yielded **no** declared field at all, of the records returned.
   *
   * `missingFields` cannot say this: it names the fields *some* record lacked,
   * so one bad row and forty empty ones read identically -- and both fail the
   * verb's post-condition, which is what turns a page the read matched perfectly
   * into a Flow that stored nothing (`content/actions/extract-list.ts`).
   * `emptyRecords` equal to `recordCount` says the selector found the rows and
   * every field read off the wrong element; `0` says the fields were read and
   * the answer is about the rows.
   *
   * Optional for the same reason `itemsSeen` is.
   */
  emptyRecords?: number | undefined;
  /** Whether a cap -- the item bound or the page bound -- cut the read short. */
  truncated: boolean;
  /** Required fields at least one record did not yield, which is the list that fails the read's post-condition. A field the author did not require is `null` in its record and is not here. Always a subset of `fieldNames`. */
  missingFields: string[];
  /** The request's field keys, excluded fields left out (D12). */
  fieldNames: string[];
  /** Whether the page ever showed the list, or absent for a read that never waited for one. */
  listPresence?: WebAutomationExtractionListPresence | undefined;
  /** What the wait for that list did, in counts and one closed word. Absent wherever `listPresence` is. */
  listWait?: WebAutomationExtractionListWait | undefined;
  /** What `where` did, or absent for a read whose request named no conditions. */
  conditions?: WebAutomationExtractionConditionReport | undefined;
  /** Every row each condition rejected, or only the rows it removed by itself, one list per condition; only when asked for (`./rejected-samples.ts`). */
  rejectedSamples?: WebAutomationExtractionRejectedRow[][] | undefined;
  /** Per condition, how many leading rows of its `rejectedSamples` list it removed alone (`./rejected-samples.ts`); beside `rejectedSamples` only. */
  rejectedSamplesAlone?: number[] | undefined;
  /** Why a read that pages stopped paging, in one closed word, or absent for a read that did not page. */
  paginationStop?: WebAutomationExtractionPaginationStop | undefined;
  /** What `dedupe` and `sort` did, or absent for a read whose request named neither. */
  order?: WebAutomationExtractionOrderReport | undefined;
  /**
   * Records a read that moves to another page (`next`, `numbered`) left out
   * because each repeated, field for field, a record an earlier page had
   * already yielded -- with or without a `dedupe`, since the page does this on
   * every such read. Counted after `where` and before `dedupe` and the item
   * bound, so `conditions.kept` above `recordCount` is these, `order.duplicates`
   * and the bound between them.
   *
   * It exists because live run `run-muqk713g` kept 12 rows through its
   * conditions and stored 10, the other two repeats of an earlier page, and
   * nothing said so: every judge, told the read did not deduplicate, asked for
   * a dedupe it already did.
   *
   * `0` from such a read that met no repeat. A read continued in another
   * document sums its documents' counts, carried in its checkpoint
   * (`apps/extension/src/shared/extraction-continuation.ts`). Absent from a read
   * that does not move to another page, from a page build that predates it, and
   * from a continued read whose checkpoint carried no count: an absent count is
   * unknown, never zero.
   */
  earlierPageRepeats?: number | undefined;
};

/**
 * Why a read that pages stopped paging (C2), in one closed word.
 *
 * **It exists because a read stopped on page one and nobody could say why.**
 * Live run `run-mulwm2dc-0bd95f22` asked the job board for `maxPages: 50` with a
 * `next` control and came back with `pagesRead: 1`, `truncated: false`, and
 * nothing else. From the bundle the stop was undeterminable: the control could
 * have named nothing, been disabled, led back to the page it was on, or been
 * pressed and ignored -- four different repairs, and the debug could only
 * reconstruct which one from the read's 10.1 s duration against the page's
 * 10 s change window. (It was the last: the site's consent wall cancels every
 * click made outside it.)
 *
 * The words, by who ends the read:
 * - the list: `control_absent` (the control the request names is not on the
 *   page), `control_disabled`, `no_following_page` (a numbered pager shows no
 *   page after the current one), `scrolled_to_end`, and `list_vanished` (the page
 *   a control led to showed no item of the list at all, and nothing to go on
 *   with);
 * - the server: `rate_limited` (the page a control led to was refused as too
 *   many requests, and still refused after the read waited and reloaded it, or
 *   the read could not afford to). Either of these two words beside
 *   `truncated: true` is a read cut short, never a complete one: live run
 *   `run-munnhi5q-4867dabe` read four of five results pages, stopped on the
 *   everything store's 429 page and answered `truncated: false`;
 * - the request's bounds: `page_limit` (`maxPages` or `maxScrolls`),
 *   `item_limit` (`maxItems`), and `deadline` (the command's `timeoutMs`);
 * - the page misbehaving: `list_unchanged` (the control was followed, and then
 *   followed by its own address, and the list never changed), `page_repeated`
 *   (the page reached showed only records earlier pages had already yielded, as
 *   a Next that leads back to the page it is on does), `control_not_clickable`,
 *   and `page_fault` (the move threw for any other reason).
 *
 * `control_absent` on page one is also what a `next` selector that names
 * nothing looks like; `pagesRead` beside it is what tells that apart from a list
 * that ended.
 */
export type WebAutomationExtractionPaginationStop =
  | "control_absent"
  | "control_disabled"
  | "no_following_page"
  | "scrolled_to_end"
  | "list_vanished"
  | "rate_limited"
  | "page_limit"
  | "item_limit"
  | "deadline"
  | "list_unchanged"
  | "page_repeated"
  | "control_not_clickable"
  | "page_fault";

/** Every pagination stop word, which is what `paginationStopValue` admits. */
const PAGINATION_STOPS: readonly WebAutomationExtractionPaginationStop[] = [
  "control_absent",
  "control_disabled",
  "no_following_page",
  "scrolled_to_end",
  "list_vanished",
  "rate_limited",
  "page_limit",
  "item_limit",
  "deadline",
  "list_unchanged",
  "page_repeated",
  "control_not_clickable",
  "page_fault"
];

/**
 * Whether the `item` selector ever named an element on the page (C2).
 *
 * It is the same defect as the condition report below, one layer up. A read
 * whose selector matches nothing waits for the list, gives up, reads the page
 * anyway and answers `succeeded` with zero records -- which is precisely what a
 * page holding nothing answers, and the two want different repairs: one changes
 * the selector, the other the instruction. Live run `run-muhnh0s5-98a27f42`
 * paid that six times over at 11.04 seconds a call while the model amended one
 * extraction and reran it, because nothing in the reply said the list had never
 * been there.
 *
 * `"never_appeared"` is therefore a fact about a successful read, never a
 * failure: an empty page is a legitimate answer and a read that finds one still
 * succeeds. It is absent from a read that never waited for a list of its own --
 * a continued read, which resumes on the page its predecessor's control
 * reached.
 *
 * A closed word rather than a count, because the count that matters is already
 * here: `recordCount` says how much was read, and what it cannot say is whether
 * there was anything there to read. One of two words cannot be confused with a
 * quantity, and, like every other value here, it carries nothing off the page.
 */
export type WebAutomationExtractionListPresence = "appeared" | "never_appeared";

/**
 * What the wait for the list did, beside the word above that says whether it
 * found one (C2): how long it waited, how many items it was waiting for, and
 * which of four things ended it.
 *
 * **It is here because the durations had to be counted by hand once already.**
 * Six live reads of the everything-store rung returned zero records and were
 * indistinguishable in their bundles; what separated them, in the end, was
 * arithmetic on `durationMs` -- 2089, 2576, 2109 and 2082 ms against reads that
 * succeeded at 255 ms and at 4.6 to 14.3 s -- because the wait's own constant
 * was 2000 ms and nothing published what any read had waited for or why it
 * stopped. That is how a seventeen-hour-old regression in the wait survived ten
 * live attempts
 * (`docs/working/language-driven-flow-loop-plan/reports/t143-why-the-read-returns-nothing.md`).
 * The read has been able to state this since the wait was fixed, but only as
 * prose in the result's comparison text, which reads well and counts for
 * nothing: a scan over a hundred and fifty bundles cannot tally a sentence. So
 * it is declared, and `stoppedOn` is a field a scan can group by.
 *
 * **Counts and one closed word, like everything else here.** `waitedMs` and
 * `waitedFor` are the wait's own numbers rather than anything measured off the
 * page, and `stoppedOn` is one of four words, so nothing needing redaction can
 * ride out on this.
 *
 * **Nothing here is a verdict, and no pairing of it with `listPresence` is
 * refused.** `"page_settled"` beside `"never_appeared"` is precisely the shape
 * of the 2026-09-25 regression, which the page can no longer produce and which
 * this therefore exists to make countable if it ever returns -- refusing the
 * pair would throw away the one report worth having. `"list_present"` beside
 * `"never_appeared"` is producible too, by a page that drew its list, ended the
 * wait, and replaced it during the settle that follows. The presence is not
 * repeated in here for the same reason: one fact, one field, and no pair of
 * copies that can disagree.
 */
export type WebAutomationExtractionListWait = {
  /** Which of the four things ended the wait for the list. */
  stoppedOn: WebAutomationExtractionWaitStop;
  /** How long the whole wait took, in milliseconds. */
  waitedMs: number;
  /** How many items the wait was waiting for: the request's own minimum, held by the page to at least one. */
  waitedFor: number;
};

/**
 * Which of the four things ended the wait for the list (C2).
 *
 * `"list_present"` is the items arriving, `"page_settled"` the document holding
 * still with some of the list drawn and the rest missing, `"window_elapsed"` the
 * read's own render window running out, and `"deadline_passed"` the command's
 * `timeoutMs`. The page decides between them
 * (`apps/extension/src/content/extraction/page-render.ts`), and there
 * `"page_settled"` is reachable only by a wait that already had items and wanted
 * more of them -- so it beside `recordCount: 0` names the regression rather than
 * describing the product.
 */
export type WebAutomationExtractionWaitStop = "list_present" | "page_settled" | "window_elapsed" | "deadline_passed";

/**
 * What a read's `where` conditions did to it (C5), in counts alone.
 *
 * It exists because a filtered read that answers with nothing is
 * indistinguishable from a page with nothing on it, and on 2026-09-24 that cost
 * a run: `run-mug3tnti-9ab80b85` returned 0 records where 13 were wanted, from
 * conditions that rejected every row, and neither the person nor the repair
 * could see which of the two had happened. The read now prefers answering with
 * the rows it rejected (`unfiltered`), and this report is how anything
 * downstream knows that is what it is looking at.
 *
 * `applied` is the items the conditions were asked about and `kept` the items
 * every condition held of. `kept` is not `recordCount`: an item the conditions
 * kept can still be dropped as a duplicate of an earlier page's row, or by the
 * item bound. `rejected` carries one count per condition, positionally, so a
 * repair can name the condition that emptied the read rather than guess among
 * four. They sum above `applied - kept` when an item failed several at once.
 *
 * A continued read reports what its own document did, since the rows an earlier
 * document rejected did not travel with its checkpoint.
 *
 * When `unfiltered` is true, `recordCount` counts rows this report also counts
 * as rejected. That is not a contradiction: they are the rows the conditions
 * turned down and the read answered with anyway, and reading the two counts
 * together is the only way to know that is what happened.
 */
export type WebAutomationExtractionConditionReport = {
  applied: number;
  kept: number;
  rejected: number[];
  /** Whether the read answered with rows its conditions rejected, because keeping only the survivors would have answered with none. */
  unfiltered: boolean;
  /** One value each condition's own read found on an item it held of, cut to 60 characters (`./seen-values.ts`); absent from a page build that predates it. */
  seen?: WebAutomationExtractionConditionSeen | undefined;
  /**
   * Per condition, positionally, the items it rejected that every other
   * condition held of: the rows it removed by itself. A row several conditions
   * rejected says nothing about whether any one of them is right, so this is
   * the count that does (`run-mup2u8o3-6697c4be`: the accessory rule rejected
   * 20 rows and removed 5 alone, 3 of them true earbuds). Counts only, so a
   * playback carries them too; never above the condition's `rejected`; absent
   * from a page build that predates it.
   */
  alone?: number[] | undefined;
};

/**
 * The summary copied field by field, or `undefined` when any part of it is not
 * well formed. Unknown keys are left behind.
 */
export function webAutomationExtractionSummaryValue(value: unknown): WebAutomationExtractionSummary | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const summary = value as Record<string, unknown>;
  const recordCount = countValue(summary.recordCount);
  const pagesRead = countValue(summary.pagesRead);
  const fieldNames = fieldKeyList(summary.fieldNames);
  const missingFields = fieldKeyList(summary.missingFields);
  if (recordCount === undefined || pagesRead === undefined || typeof summary.truncated !== "boolean" || fieldNames === undefined || missingFields === undefined) return undefined;
  if (!missingFields.every((key) => fieldNames.includes(key))) return undefined;
  // Absent for a read with no conditions, and, when sent, held to the same rule
  // as everything else here: unreadable drops the whole summary rather than
  // arriving as a report that says something the read did not do.
  const conditions = summary.conditions === undefined ? undefined : conditionReportValue(summary.conditions);
  if (summary.conditions !== undefined && conditions === undefined) return undefined;
  // Only beside the counts, cut to their bounds whatever the page sent; malformed drops the summary.
  const rejectedSamples = summary.rejectedSamples === undefined ? undefined : webAutomationExtractionRejectedSamplesValue(summary.rejectedSamples, conditions?.rejected.length ?? -1, fieldNames);
  if (summary.rejectedSamples !== undefined && rejectedSamples === undefined) return undefined;
  // How many of each list lead as rows its condition removed alone: only beside the lists, held to them.
  const rejectedSamplesAlone = summary.rejectedSamplesAlone === undefined || rejectedSamples === undefined
    ? undefined
    : webAutomationExtractionRejectedSamplesAloneValue(summary.rejectedSamplesAlone, rejectedSamples);
  if (summary.rejectedSamplesAlone !== undefined && rejectedSamplesAlone === undefined) return undefined;
  // Optional, so an extension build that predates it still sends a summary that
  // arrives whole; a word this side does not know drops the summary rather than
  // arriving as a half-understood fact.
  const listPresence = listPresenceValue(summary.listPresence);
  if (summary.listPresence !== undefined && listPresence === undefined) return undefined;
  // The wait's own account, held to the same rule, and for a reason the field it
  // sits beside settles: absence already means "this read never waited for a list
  // of its own", so an account dropped for being unreadable while the rest of the
  // summary arrived would make absence mean two things at once -- and a reader
  // counting `stoppedOn` over a run's bundles would silently count a continued
  // read and a half-understood one as the same thing. Dropping the summary is
  // conspicuous; an account that quietly went missing is what cost t143 a day.
  const listWait = listWaitValue(summary.listWait);
  if (summary.listWait !== undefined && listWait === undefined) return undefined;
  // The two counts a zero read is diagnosed by, held to the same rule: optional,
  // so a page build that predates them still sends a summary that arrives whole,
  // and unreadable when sent drops the whole summary rather than arriving as a
  // count of something the read did not do.
  const itemsSeen = countValue(summary.itemsSeen);
  const emptyRecords = countValue(summary.emptyRecords);
  if (summary.itemsSeen !== undefined && itemsSeen === undefined) return undefined;
  if (summary.emptyRecords !== undefined && emptyRecords === undefined) return undefined;
  // Why paging stopped, held to the rule `listPresence` is: optional, so a page
  // build that predates it still sends a summary that arrives whole, and a word
  // outside the set drops the summary rather than arriving half understood.
  const paginationStop = paginationStopValue(summary.paginationStop);
  if (summary.paginationStop !== undefined && paginationStop === undefined) return undefined;
  // What dedupe and sort did, held to the same rule.
  const order = summary.order === undefined ? undefined : webAutomationExtractionOrderReportValue(summary.order);
  if (summary.order !== undefined && order === undefined) return undefined;
  // The repeats of earlier pages the read left out, held to the rule every count is.
  const earlierPageRepeats = countValue(summary.earlierPageRepeats);
  if (summary.earlierPageRepeats !== undefined && earlierPageRepeats === undefined) return undefined;
  // No cross-check against `recordCount`, unlike `kept > applied` below: a
  // continued read carries its predecessor's records, so `recordCount` above
  // `itemsSeen` is a legitimate read, and dropping the account would lose the
  // one thing a zero read cannot afford to.
  return {
    recordCount,
    pagesRead,
    truncated: summary.truncated,
    missingFields,
    fieldNames,
    ...(itemsSeen !== undefined ? { itemsSeen } : {}),
    ...(emptyRecords !== undefined ? { emptyRecords } : {}),
    ...(listPresence !== undefined ? { listPresence } : {}),
    ...(listWait !== undefined ? { listWait } : {}),
    ...(conditions !== undefined ? { conditions } : {}),
    ...(rejectedSamples !== undefined ? { rejectedSamples } : {}),
    ...(rejectedSamplesAlone !== undefined ? { rejectedSamplesAlone } : {}),
    ...(paginationStop !== undefined ? { paginationStop } : {}),
    ...(order !== undefined ? { order } : {}),
    ...(earlierPageRepeats !== undefined ? { earlierPageRepeats } : {})
  };
}

/** The one word that says why paging stopped, or `undefined` for anything else. */
function paginationStopValue(value: unknown): WebAutomationExtractionPaginationStop | undefined {
  return typeof value === "string" && (PAGINATION_STOPS as readonly string[]).includes(value)
    ? value as WebAutomationExtractionPaginationStop
    : undefined;
}

/** The one word that says whether the list was ever there, or `undefined` for anything else. */
function listPresenceValue(value: unknown): WebAutomationExtractionListPresence | undefined {
  return value === "appeared" || value === "never_appeared" ? value : undefined;
}

/**
 * The wait's account copied member by member, or `undefined` for one that is not
 * well formed.
 *
 * No bound is put on either number. `waitedFor: 0` is not a shape the page
 * writes -- it holds the wait to at least one item -- but refusing it would cost
 * the whole summary for a number that is merely surprising rather than unsafe,
 * and a wait longer than any constant this side knows is a fact about a page
 * rather than a malformed report. What is refused is a `stoppedOn` outside the
 * set, because that is the one member a free string could arrive on.
 */
function listWaitValue(value: unknown): WebAutomationExtractionListWait | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const wait = value as Record<string, unknown>;
  const stoppedOn = waitStopValue(wait.stoppedOn);
  const waitedMs = countValue(wait.waitedMs);
  const waitedFor = countValue(wait.waitedFor);
  if (stoppedOn === undefined || waitedMs === undefined || waitedFor === undefined) return undefined;
  return { stoppedOn, waitedMs, waitedFor };
}

/** The one word that says what ended the wait, or `undefined` for anything else. */
function waitStopValue(value: unknown): WebAutomationExtractionWaitStop | undefined {
  return value === "list_present" || value === "page_settled" || value === "window_elapsed" || value === "deadline_passed" ? value : undefined;
}

/** The condition report copied count by count, or `undefined` for one that is not well formed. */
function conditionReportValue(value: unknown): WebAutomationExtractionConditionReport | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const report = value as Record<string, unknown>;
  const applied = countValue(report.applied);
  const kept = countValue(report.kept);
  const rejected = Array.isArray(report.rejected) && report.rejected.every((entry) => countValue(entry) !== undefined)
    ? report.rejected as number[]
    : undefined;
  if (applied === undefined || kept === undefined || rejected === undefined || typeof report.unfiltered !== "boolean") return undefined;
  // A read cannot have kept more items than it looked at.
  if (kept > applied) return undefined;
  const seen = report.seen === undefined ? undefined : webAutomationExtractionConditionSeenValue(report.seen, rejected.length);
  if (report.seen !== undefined && seen === undefined) return undefined;
  // One count per condition, none above that condition's own rejections.
  const alone = report.alone === undefined ? undefined : aloneCounts(report.alone, rejected);
  if (report.alone !== undefined && alone === undefined) return undefined;
  return {
    applied,
    kept,
    rejected: [...rejected],
    unfiltered: report.unfiltered,
    ...(seen !== undefined ? { seen } : {}),
    ...(alone !== undefined ? { alone } : {})
  };
}

/** One count per condition, each at most that condition's rejections, or `undefined`. */
function aloneCounts(value: unknown, rejected: readonly number[]): number[] | undefined {
  if (!Array.isArray(value) || value.length !== rejected.length) return undefined;
  return value.every((entry, index) => countValue(entry) !== undefined && entry <= (rejected[index] ?? 0)) ? [...value as number[]] : undefined;
}

function countValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function fieldKeyList(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every(isWebAutomationExtractFieldKey) ? [...value] : undefined;
}
