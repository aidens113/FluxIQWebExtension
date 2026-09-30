/**
 * What one `web.dom.extract_list` read said about **itself**, as a run's
 * `snapshots/flow-lane.json` records it — on each extract attempt in
 * `actions[]`, and beside the oracle's comparison on each judged step in
 * `extraction.steps[]`.
 *
 * **Why this exists.** The bundle published the oracle's side of the
 * comparison and nothing of the read's. `observedRecords: 0, comparedRecords:
 * 0, expectedFields: 0` says the answer was wrong and cannot say why, and the
 * three reasons a read comes back empty want three different repairs:
 *
 * - the `item` selector named nothing, so there was never a list to read —
 *   `listPresence: "never_appeared"`, and the selector is what to change;
 * - the page genuinely held nothing — `listPresence: "appeared"` with
 *   `recordCount: 0`, and the instruction is what to change;
 * - the `where` conditions rejected every row — `conditions.kept: 0` with
 *   `conditions.applied` above it, and the conditions are what to narrow;
 * - the rows were there and every field was read off the wrong element —
 *   `emptyRecords` equal to `recordCount`, and the field selectors are what to
 *   change;
 * - the wait gave up before the list finished drawing — `listWait.stoppedOn:
 *   "page_settled"`, and the wait is what to fix. This one was diagnosed once by
 *   timing fourteen attempts, because the read could not say it (see
 *   `RunExtractionListWait`).
 *
 * The domain computes all three on every read (`domain/src/actions/extraction/
 * summary.ts`) and they were dropped on the way out: Core's run detail reduced
 * an attempt's outputs to names and counts, so nothing downstream could see
 * them. Core now projects the summary onto `metadata.extraction`
 * (`service/summaries/extraction-summary.ts`) and this is the shape it arrives
 * in.
 *
 * **What may travel.** Counts, booleans, one word from a closed set, and
 * record field keys. Nothing else can be spelled in any member: a field key is
 * 1 to 100 characters of `A-Z a-z 0-9 _ -`, so it holds no space and therefore
 * no page text, no selector, no URL and no sentence. The keys are the read's
 * own declared columns, which `snapshots/flow-lane.json` already publishes in
 * full under `authoredNodes[].parameters.extractList.fields` — this names a
 * subset of what is already there rather than a new class of string.
 *
 * **Absent stays absent.** A read that recorded no summary publishes none. An
 * attempt with no `extraction` member did not report one, and is never an
 * empty record standing in for one.
 */
export type RunExtractionRead = {
  /** Records the read returned, across every page it read. */
  recordCount: number;
  /** Pages the read covered, the first included. */
  pagesRead: number;
  /** Whether a cap — the item bound or the page bound — cut the read short. */
  truncated: boolean;
  /** The read's declared field keys, excluded fields left out. */
  fieldNames: string[];
  /** Declared fields at least one record did not yield. Always a subset of `fieldNames`. */
  missingFields: string[];
  /**
   * Items the `item` selector matched, across every page the read covered,
   * before any condition, any duplicate and the item bound — or absent from a
   * read whose producer did not count them.
   *
   * It is the count that splits the two halves of a zero read that
   * `listPresence` cannot and `conditions.applied` is often absent for.
   * `itemsSeen: 0` is the selector; `itemsSeen` above `recordCount` with no
   * conditions is duplicates or the bound.
   */
  itemsSeen?: number;
  /**
   * Records that yielded **no** declared field at all, of the records returned —
   * or absent from a read whose producer did not count them.
   *
   * `missingFields` cannot say this: it names the fields *some* record lacked,
   * so one bad row and forty empty ones read identically. `emptyRecords` equal
   * to `recordCount` says the selector found the rows and every field was read
   * off the wrong element; `0` says the fields were read and the answer is about
   * the rows.
   */
  emptyRecords?: number;
  /**
   * Whether the page ever showed the list the read waited for, or absent for a
   * read that waited for none — a continued read, which resumes on the page its
   * predecessor's control reached.
   *
   * `never_appeared` is a fact about a **successful** read, never a failure: an
   * empty page is a legitimate answer and a read that finds one still succeeds.
   */
  listPresence?: RunExtractionListPresence;
  /** What the wait for that list did, in two durations and one closed word. Absent wherever `listPresence` is. */
  listWait?: RunExtractionListWait;
  /** What the read's `where` did to it, or absent for a read whose request named no conditions. */
  conditions?: RunExtractionConditionReport;
  /**
   * Why a read that paged stopped paging, in one closed word, or absent for a
   * read that did not page. `truncated` beside it says whether the stop cut the
   * read short: `list_vanished` and `rate_limited` are a page advance that lost
   * the list, which live run `run-munnhi5q-4867dabe` answered as a complete read
   * of four of five pages -- and a bundle could not say how that read ended.
   */
  paginationStop?: RunExtractionPaginationStop;
};

/**
 * Why a paginated read stopped paging: the domain's closed set
 * (`WebAutomationExtractionPaginationStop`), `rate_limited` ahead of it, and
 * `unknown` for a word this contract has not been told about, on the rule
 * `RUN_EXTRACTION_WAIT_STOP` states. Core's projection already publishes a word
 * it does not know as `unknown`.
 */
export const RUN_EXTRACTION_PAGINATION_STOP = [
  "control_absent", "control_disabled", "no_following_page", "scrolled_to_end", "list_vanished", "rate_limited",
  "page_limit", "item_limit", "deadline", "list_unchanged", "page_repeated", "control_not_clickable", "page_fault", "unknown"
] as const;
export type RunExtractionPaginationStop = (typeof RUN_EXTRACTION_PAGINATION_STOP)[number];

/** The two words a read uses for whether its `item` selector ever named an element on the page. */
export const RUN_EXTRACTION_LIST_PRESENCE = ["appeared", "never_appeared"] as const;
export type RunExtractionListPresence = (typeof RUN_EXTRACTION_LIST_PRESENCE)[number];

/**
 * What the read's wait for its list did, beside the word that says whether it
 * found one.
 *
 * **It is in the bundle because the durations were once counted by hand.** Six
 * live reads of the everything-store rung returned zero records and were
 * indistinguishable in their bundles; what separated them, in the end, was
 * arithmetic on `durationMs` — 2089, 2576, 2109 and 2082 ms against reads that
 * succeeded at 255 ms and at 4.6 to 14.3 s — because the wait's own constant was
 * 2000 ms and nothing published what a read had waited for or why it stopped.
 * That is how a seventeen-hour-old regression in the wait survived ten live
 * attempts. A scan over a hundred and fifty bundles cannot tally a duration
 * against a constant it would have to know; it can group by `stoppedOn`.
 */
export type RunExtractionListWait = {
  /** Which of the mechanisms below ended the wait, or `unknown` for one this contract has not been told about. */
  stoppedOn: RunExtractionWaitStop;
  /** How long the whole wait took, in milliseconds. */
  waitedMs: number;
  /** How many items the wait was waiting for: the request's own minimum, held to at least one. */
  waitedFor: number;
};

/**
 * What ended a read's wait for its list.
 *
 * `list_present` is the items arriving, `page_settled` the document holding
 * still with some of the list drawn and the rest missing, `window_elapsed` the
 * read's own render window running out, and `deadline_passed` the command's
 * `timeoutMs`. `page_settled` beside `recordCount: 0` is the 2026-09-25
 * regression's signature rather than a description of the product.
 *
 * `unknown` is the fifth, and it is a word about this boundary rather than about
 * the page: the producer named a mechanism the reader had not been told about.
 * It is here because the alternative is worse. The set enumerates *mechanisms*
 * and mechanisms get added, the producing domain and the reading facility ship
 * separately, and refusing an unfamiliar word would empty every bundle of the
 * one account a zero read cannot be diagnosed without. The word the producer
 * actually sent is **not** carried: every member of a read is a count, a
 * boolean, a closed word or a field key precisely so that no free string can
 * ride into a bundle, and `stoppedOn` is the one member a free string could
 * arrive on.
 */
export const RUN_EXTRACTION_WAIT_STOP = ["list_present", "page_settled", "window_elapsed", "deadline_passed", "unknown"] as const;
export type RunExtractionWaitStop = (typeof RUN_EXTRACTION_WAIT_STOP)[number];

/**
 * What a read's `where` conditions did to it, in counts alone.
 *
 * `applied` is the items the conditions were asked about and `kept` the items
 * every condition held of. `kept` is not `recordCount`: an item the conditions
 * kept can still be dropped as a duplicate of an earlier page's row, or by the
 * item bound. `rejected` carries one count per condition, positionally, so a
 * reader can name the condition that emptied a read rather than guess among
 * four; the counts sum above `applied - kept` when an item failed several at
 * once.
 *
 * `unfiltered: true` means the read answered with rows its conditions
 * **rejected**, because keeping only the survivors would have answered with
 * none. Then `recordCount` counts rows this report also counts as rejected,
 * which is not a contradiction: reading the two together is the only way to
 * know that is what happened.
 */
export type RunExtractionConditionReport = {
  applied: number;
  kept: number;
  /** One rejection count per condition, in the order the request declared them. */
  rejected: number[];
  /** Whether the read answered with the rows its conditions rejected. */
  unfiltered: boolean;
};

/**
 * The bounds this contract holds a read's summary to. They are the limits
 * Core's own record schema enforces on a field key, restated here because this
 * is the side that checks rather than the side that produces: a producer that
 * stopped applying one of them must fail a validation, not merely differ.
 */
export const RUN_EXTRACTION_READ_BOUNDS = Object.freeze({
  /** Letters, digits, `_` and `-`, 1 to 100 characters — the pattern a stored dataset's field id is held to. */
  fieldKeyPattern: /^[A-Za-z0-9_-]{1,100}$/u,
  /** Keys that collide with object machinery when a row is read by key, which no schema may declare. */
  reservedFieldKeys: Object.freeze(["__proto__", "constructor", "prototype"] as const),
  /** At most this many declared fields, as a stored record schema allows. */
  maxFields: 200,
  /**
   * At most this many `where` conditions. A read carries one rejection count
   * per condition it was given, and a longer list is not one the product
   * writes, so an unbounded array is refused rather than republished.
   */
  maxConditions: 64
});
