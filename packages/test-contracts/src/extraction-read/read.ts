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
 *   `conditions.applied` above it, and the conditions are what to narrow.
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
   * Whether the page ever showed the list the read waited for, or absent for a
   * read that waited for none — a continued read, which resumes on the page its
   * predecessor's control reached.
   *
   * `never_appeared` is a fact about a **successful** read, never a failure: an
   * empty page is a legitimate answer and a read that finds one still succeeds.
   */
  listPresence?: RunExtractionListPresence;
  /** What the read's `where` did to it, or absent for a read whose request named no conditions. */
  conditions?: RunExtractionConditionReport;
};

/** The two words a read uses for whether its `item` selector ever named an element on the page. */
export const RUN_EXTRACTION_LIST_PRESENCE = ["appeared", "never_appeared"] as const;
export type RunExtractionListPresence = (typeof RUN_EXTRACTION_LIST_PRESENCE)[number];

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
