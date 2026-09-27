// What a `web.dom.extract_list` attempt said about its own read, on the way
// into the run bundle.
//
// **The gap this closes.** The bundle published the oracle's side of the
// comparison and nothing of the read's. `run-muhrf6c4-9714939f` recorded
// `observedRecords: 0, comparedRecords: 0, expectedFields: 0` against an
// expectation of 13 records -- which says the answer was wrong and says nothing
// about why. The read itself had already computed the answer: how many records
// it returned over how many pages, which declared fields a row did not yield,
// whether a cap cut it short, whether the list it waited for was ever on the
// page, and what each `where` condition kept and rejected
// (`domain/src/actions/extraction/summary.ts`). All of it was dropped on the
// way out, because Core's run detail reduces an attempt's outputs to names and
// counts.
//
// Core now projects the summary onto the attempt's `metadata.extraction`
// (`service/summaries/extraction-summary.ts`, beside the host target
// resolution that travels the same way and for the same reason). This reader is
// the bundle's side of it.
//
// **Rebuilt, then checked.** Every member is copied by name from something this
// module recognises -- a count, a boolean, one of two words, a field key -- and
// the result is put through the published contract's own validator before it
// leaves. Core narrows the record where it projects it; this narrows it again,
// because a bundle's contents are this package's to answer for.
//
// **A read that recorded nothing publishes nothing.** A summary this reader
// cannot rebuild whole is absent, never an empty record standing in for one,
// and never a failure: an attempt that reported no summary is a perfectly
// ordinary attempt, including every non-extraction action in the run. That is
// why this refuses rather than throwing the way `harness-recovery.ts` does --
// the recovery record is the measurement there, and here an unreadable summary
// must not cost a run that otherwise says what it did.
//
// **One word is resolved rather than refused, and that is the whole difference
// between this side and the contract's validator.** `listWait.stoppedOn`
// enumerates the mechanisms that can end a read's wait for its list, and
// mechanisms get added; the domain that produces them and this facility that
// reads them ship separately, and nothing sequences the two. So a word this
// reader has not been told about is rebuilt as `"unknown"` -- named, and carried
// through with the two durations beside it -- rather than costing the read the
// rest of its account. Strict where a read is authored, tolerant where one is
// ingested, which is the shape this repository already takes with an
// unrecognised failure category (`bench/evaluate-run.ts`, where a foreign
// category becomes `"unknown"` rather than failing the run's evaluation).
//
// Redaction is untouched by that: the producer's word is **discarded**, not
// republished, so what reaches the bundle is still one of a closed set. And the
// tolerance stops at the word. Version skew adds words; it does not turn a
// count into a string, so a malformed member still drops the read -- which is
// also what keeps the *absence* of `listWait` meaning one thing, namely that the
// read waited for no list of its own.
import { isRunExtractionFieldKey, validateRunExtractionRead, RUN_EXTRACTION_LIST_PRESENCE, RUN_EXTRACTION_READ_BOUNDS, type RunExtractionConditionReport, type RunExtractionListPresence, type RunExtractionListWait, type RunExtractionRead, type RunExtractionWaitStop } from "@fluxiq-web-extension/test-contracts";

/** The four mechanisms a producer can name; a fifth becomes `"unknown"` rather than costing the read. */
const KNOWN_WAIT_STOPS: readonly RunExtractionWaitStop[] = ["list_present", "page_settled", "window_elapsed", "deadline_passed"];

/**
 * Core's `metadata.extraction` for one attempt, rebuilt member by member, or
 * `undefined` when the attempt dispatched no list read, reported no summary, or
 * reported one this reader cannot rebuild whole.
 *
 * Admitted whole or not at all, the rule the producer set: its own copy drops
 * the entire summary rather than let one unreadable member through, on the
 * reasoning that a half-read account is worse than none, and reading it back
 * more permissively here would undo that.
 *
 * The one exception is an unfamiliar `listWait.stoppedOn`, which is rebuilt as
 * `"unknown"` and keeps its read. The header says why: a word is the one thing a
 * newer producer legitimately adds, and there the rule above costs a whole run
 * every read's account rather than costing one word its name.
 */
export function extractionReadOf(attempt: Record<string, unknown>): RunExtractionRead | undefined {
  const summary = optionalRecord(optionalRecord(attempt.metadata)?.extraction);
  if (!summary) return undefined;
  const { recordCount, pagesRead, truncated, fieldNames, missingFields, itemsSeen, emptyRecords, listPresence, listWait, conditions } = summary;
  if (!isCount(recordCount) || !isCount(pagesRead) || typeof truncated !== "boolean") return undefined;
  const declared = fieldKeys(fieldNames);
  const missing = fieldKeys(missingFields);
  if (declared === undefined || missing === undefined) return undefined;
  // A field a row did not yield is one of the read's own declared fields.
  if (!missing.every((key) => declared.includes(key))) return undefined;
  // Absent from a producer that did not count them, a count when sent, and never
  // checked against `recordCount` or each other: `itemsSeen: 0` beside records,
  // `itemsSeen` far above them, and `emptyRecords` equal to `recordCount` are
  // each a real read that a diagnosis needs to see rather than a malformed one.
  if (itemsSeen !== undefined && !isCount(itemsSeen)) return undefined;
  if (emptyRecords !== undefined && !isCount(emptyRecords)) return undefined;
  if (listPresence !== undefined && !isListPresence(listPresence)) return undefined;
  const wait = listWait === undefined ? undefined : listWaitOf(listWait);
  if (listWait !== undefined && wait === undefined) return undefined;
  const report = conditions === undefined ? undefined : conditionReportOf(conditions);
  if (conditions !== undefined && report === undefined) return undefined;
  const read: RunExtractionRead = {
    recordCount,
    pagesRead,
    truncated,
    fieldNames: declared,
    missingFields: missing,
    ...(isCount(itemsSeen) ? { itemsSeen } : {}),
    ...(isCount(emptyRecords) ? { emptyRecords } : {}),
    ...(isListPresence(listPresence) ? { listPresence } : {}),
    ...(wait ? { listWait: wait } : {}),
    ...(report ? { conditions: report } : {}),
  };
  // The published contract's own check, run on the way in rather than asserted
  // in a test alone: a member this reader rebuilt wrongly is then absent from
  // the bundle instead of published as a fact about the read.
  return validateRunExtractionRead(read).valid ? read : undefined;
}

/**
 * What the read's wait for its list did: two durations and the mechanism that
 * ended it, with a mechanism this reader does not know rebuilt as `"unknown"`.
 *
 * `undefined` only for an account that is not well formed — a duration that is
 * not a count, or a `stoppedOn` that is not even a string — and then the whole
 * read is dropped, so absence of `listWait` in a bundle keeps meaning exactly
 * one thing: the read waited for no list of its own.
 */
function listWaitOf(value: unknown): RunExtractionListWait | undefined {
  const wait = optionalRecord(value);
  if (!wait) return undefined;
  const { stoppedOn, waitedMs, waitedFor } = wait;
  if (typeof stoppedOn !== "string" || !isCount(waitedMs) || !isCount(waitedFor)) return undefined;
  return { stoppedOn: waitStopOf(stoppedOn), waitedMs, waitedFor };
}

/** The mechanism the producer named, or `"unknown"` for one this reader has not been told about. */
function waitStopOf(value: string): RunExtractionWaitStop {
  return (KNOWN_WAIT_STOPS as readonly string[]).includes(value) ? value as RunExtractionWaitStop : "unknown";
}

/** What the read's `where` did, in counts alone; `undefined` for a report that is not well formed. */
function conditionReportOf(value: unknown): RunExtractionConditionReport | undefined {
  const report = optionalRecord(value);
  if (!report) return undefined;
  const { applied, kept, rejected, unfiltered } = report;
  if (!isCount(applied) || !isCount(kept) || typeof unfiltered !== "boolean") return undefined;
  // A read cannot have kept more items than it looked at.
  if (kept > applied) return undefined;
  if (!Array.isArray(rejected) || rejected.length === 0 || rejected.length > RUN_EXTRACTION_READ_BOUNDS.maxConditions) return undefined;
  return rejected.every(isCount) ? { applied, kept, rejected: [...rejected], unfiltered } : undefined;
}

/**
 * A list of the read's declared field keys, deduplicated by refusal rather
 * than by rewriting: a summary naming one field twice is not one the producer
 * writes.
 */
function fieldKeys(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length > RUN_EXTRACTION_READ_BOUNDS.maxFields) return undefined;
  if (!value.every(isRunExtractionFieldKey)) return undefined;
  return new Set(value).size === value.length ? [...value] as string[] : undefined;
}

function isListPresence(value: unknown): value is RunExtractionListPresence {
  return typeof value === "string" && (RUN_EXTRACTION_LIST_PRESENCE as readonly string[]).includes(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function optionalRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

/**
 * The reads each node made, in attempt order, keyed by node id.
 *
 * It is how a judged extract step reaches the read that produced its dataset:
 * a dataset names the nodes that wrote rows to it, and this names what each of
 * those nodes said about its own read. A node with no read that reported a
 * summary has no entry, rather than an empty list.
 *
 * Shaped by what it needs rather than by the attempt type, so the run reader
 * and the judgement do not have to import one another.
 */
export function extractionReadsByNode(actions: readonly { nodeId: string | null; extraction?: RunExtractionRead | undefined }[]): Map<string, RunExtractionRead[]> {
  const reads = new Map<string, RunExtractionRead[]>();
  for (const action of actions) {
    if (!action.nodeId || !action.extraction) continue;
    const found = reads.get(action.nodeId);
    if (found) found.push(action.extraction);
    else reads.set(action.nodeId, [action.extraction]);
  }
  return reads;
}
