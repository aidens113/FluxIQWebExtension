// The rows a read's `where` conditions turned down, shown to the model that
// wrote the conditions while it can still change them.
//
// A read the model runs while exploring already comes back with a sample of
// the rows it kept (`./read-result.ts`) and, per condition, how many rows each
// rejected. Counts cannot say *which* rows: on `run-munq5s8x-6d620cdf` the
// accessory rule `name not contains ["charging case", ...]` rejected 16 rows,
// three of them true earbuds named "... Wireless Charging Case ...", and the
// build and the re-author both saw only the 16. So the one command an
// exploring node run dispatches asks the page for a few of each condition's
// rejected rows (`actions/extraction/rejected-samples.ts`), and this module
// puts them beside the kept rows in the read the model is shown.
//
// **The rows a condition removed by itself are said apart from the rest.** A row
// that also failed another condition would be gone without this one, so it says
// nothing about whether this one is right. `run-mup2u8o3-6697c4be` showed the
// model "rejected 20" for the accessory rule, 17 of which also failed price,
// rating or Plus; the 5 it removed alone were 2 accessories and the 3 true
// earbuds "... with Wireless Charging Case", and those 5 show at a glance what
// the 20 hide. So each condition says `alone` (how many it removed alone),
// `rowsAlone` and `rowsWithOthers`, and the read carries one sentence telling
// the model which to check (`REJECTED_ROWS_NOTE`). A page build that does not
// order its rows says `rows` as before.
//
// **They go nowhere else.** They are asked for on the dispatched command only,
// never on the parameters the Flow keeps, so a playback asks for none. They are
// taken out of the payload before it is recorded for the draft's replay
// (`./replay.ts` counts a payload's longest list, and a sample is not a row of
// the answer). And they sit inside the read, inside the evidence, never as a
// member of the execution result: Core reads that against a closed list and
// refuses the whole call for a key it has not learned
// (`WEB_LLM_EVIDENCE_RESULT_KEYS_CORE_READS`).

import type { JsonObject, JsonValue } from "fluxiq/core";
import {
  webAutomationExtractionSummaryValue,
  WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_ALONE_KEY,
  WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_KEY,
  webAutomationExtractListRequestRead,
  type WebAutomationExtractItemCondition,
  type WebAutomationExtractionRejectedRow
} from "../../../actions/extraction";
import { webNodeNumericTextFilterSentence } from "./numeric-text-filter";
import { present } from "../present";
import { webNodeWithoutPageRecord } from "./page-record";
import { webNodeReadResult } from "./read-result";

/** The only verb whose rows a condition decides. */
const EXTRACT_LIST_ACTION = "web.dom.extract_list";

/** The one sentence the model is given beside `rejectedRows`, when some condition removed rows alone. */
export const WEB_NODE_REJECTED_ROWS_NOTE = "In rejectedRows, rowsAlone are rows that condition removed by itself (every other condition kept them): check each against the instruction, and if any is a row the instruction asks for, that condition is wrong and must change; rowsWithOthers also failed another condition.";

/**
 * One condition's rejected rows as the model is shown them: `rowsAlone` and
 * `rowsWithOthers` from a page that ordered them, `rows` from one that did not.
 */
type WebNodeRejectedRowsEntry = {
  where: number;
  rejected: number;
  alone?: number | undefined;
  rows?: JsonObject[] | undefined;
  rowsAlone?: JsonObject[] | undefined;
  rowsWithOthers?: JsonObject[] | undefined;
};

/** What the read carries beside its kept rows: the rejected rows, and the sentence on which to check. */
type WebNodeRejectedRowsBeside = { rejectedRows: JsonValue; rejectedRowsNote?: string | undefined };

/** What a read gives the model, and the payload as it may be recorded, without the samples. */
export type WebNodeReadWithRejectedRows = { read: JsonValue | undefined; recorded: JsonValue | undefined };

/**
 * The parameters the command goes out with: the node's own, and for a list
 * read that belongs in the Flow the request for rejected-row samples. Never the
 * parameters the Flow keeps.
 */
export function webNodeDispatchParameters(node: { actionType: string; proposes: boolean }, ran: JsonObject): JsonObject {
  if (node.actionType !== EXTRACT_LIST_ACTION || !node.proposes) return ran;
  return { ...ran, [WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_KEY]: true };
}

/**
 * The read the model is shown -- the kept rows whole, as `./read-result.ts`
 * returns them, with `rejectedRows` beside them when a condition turned rows
 * down, and never the page's own record (`./page-record.ts`) -- and the
 * payload with the samples taken out.
 *
 * Nothing is fitted to a byte budget (t200): the samples are as many as the
 * page's sampling returned (`actions/extraction/rejected-samples.ts`), and both
 * halves pass the same screen, so a denied key or a credential-shaped string is
 * withheld from the samples exactly as it is from the kept rows.
 *
 * `parameters` are the ones the node ran with. Given, a text condition
 * (`matches`, `contains`) whose rejected rows all read as numbers in its
 * column adds one sentence to the note (`./numeric-text-filter.ts`, run 36):
 * a bound reads "Aisha Khan and 4 other mutual friends" as 5, a pattern does
 * not.
 */
export function webNodeReadWithRejectedRows(payload: JsonValue | undefined, parameters?: JsonObject): WebNodeReadWithRejectedRows {
  const recorded = withoutSamples(payload);
  const shown = rejectedRows(payload, conditionsRan(parameters));
  // The page's own record never reaches the model (`./page-record.ts`); the
  // replay keeps the payload as the node answered it.
  const read = webNodeReadResult(webNodeWithoutPageRecord(recorded));
  if (shown === undefined) return { read, recorded };
  const beside = present<WebNodeRejectedRowsBeside>({ rejectedRows: shown.rows, rejectedRowsNote: note(shown) }) as JsonObject;
  if (read === undefined) return { read: beside, recorded };
  if (typeof read !== "object" || read === null || Array.isArray(read)) return { read, recorded };
  return { read: { ...read, ...beside }, recorded };
}

/** The summary members that carry the samples, which the recorded payload leaves out. */
const SAMPLE_KEYS: readonly string[] = [WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_KEY, WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_ALONE_KEY];

/** The payload with `extraction.rejectedSamples` and its alone counts removed, and unchanged when it carries neither. */
function withoutSamples(payload: JsonValue | undefined): JsonValue | undefined {
  const whole = objectValue(payload);
  const extraction = objectValue(whole?.extraction);
  if (whole === undefined || extraction === undefined || !SAMPLE_KEYS.some((key) => Object.hasOwn(extraction, key))) return payload;
  const rest: JsonObject = {};
  for (const [key, value] of Object.entries(extraction)) if (!SAMPLE_KEYS.includes(key)) rest[key] = value;
  return { ...whole, extraction: rest };
}

/**
 * Each condition that turned rows down, by its position in `where`, with how
 * many it rejected, how many of those it removed alone, and every row the page
 * sampled for it: the alone rows apart from the rows another condition also
 * rejected. `anyAlone` is whether any condition has an alone row to check.
 *
 * The samples are read through the summary's own copy, so only the read's
 * declared fields arrive, every row the page rejected, whole; the same screen
 * as the kept rows then drops a key Core denies in evidence and withholds a
 * credential-shaped string (`./read-result.ts`).
 */
function rejectedRows(payload: JsonValue | undefined, conditions: readonly WebAutomationExtractItemCondition[] | undefined): ShownRejectedRows | undefined {
  const summary = webAutomationExtractionSummaryValue(objectValue(payload)?.extraction);
  const samples = summary?.rejectedSamples;
  const counts = summary?.conditions?.rejected;
  if (samples === undefined || counts === undefined) return undefined;
  const leads = summary?.rejectedSamplesAlone;
  const aloneCounts = summary?.conditions?.alone;
  let anyAlone = false;
  const shown: JsonObject[] = samples.flatMap((sampled, index): JsonObject[] => {
    if (sampled.length === 0) return [];
    const rejected = counts[index] ?? sampled.length;
    const lead = leads?.[index];
    if (lead !== undefined && lead > 0) anyAlone = true;
    // A page build that did not order its rows says every row, unsplit.
    return [present<WebNodeRejectedRowsEntry>({
      where: index,
      rejected,
      alone: aloneCounts?.[index] ?? lead,
      rows: lead === undefined ? sampled.map(row) : undefined,
      rowsAlone: lead === undefined ? undefined : sampled.slice(0, lead).map(row),
      rowsWithOthers: lead === undefined ? undefined : sampled.slice(lead).map(row)
    }) as JsonObject];
  });
  if (shown.length === 0) return undefined;
  const screened = webNodeReadResult(shown);
  if (screened === undefined) return undefined;
  return { rows: screened, anyAlone, numeric: conditions === undefined ? [] : numericSentences(screened, conditions) };
}

/** The rejected rows as shown, whether any condition removed one alone, and the numeric-column sentences. */
type ShownRejectedRows = { rows: JsonValue; anyAlone: boolean; numeric: string[] };

/** The note beside `rejectedRows`: the alone sentence when it applies, then each numeric-column sentence. */
function note(shown: ShownRejectedRows): string | undefined {
  const sentences = [...(shown.anyAlone ? [WEB_NODE_REJECTED_ROWS_NOTE] : []), ...shown.numeric];
  return sentences.length === 0 ? undefined : sentences.join(" ");
}

/**
 * The `where` the node ran with, positionally as the page counts it, or
 * `undefined` when there is none or a condition of it was dropped -- a dropped
 * condition would shift every index after it, and a sentence about the wrong
 * condition is worse than none.
 */
function conditionsRan(parameters: JsonObject | undefined): readonly WebAutomationExtractItemCondition[] | undefined {
  if (parameters === undefined) return undefined;
  const read = webAutomationExtractListRequestRead(parameters.extractList);
  if (read.dropped.some((part) => part.startsWith("where."))) return undefined;
  return read.request?.where;
}

/** One sentence per shown condition whose rejected rows read as numbers in a column it tested as text. */
function numericSentences(screened: JsonValue, conditions: readonly WebAutomationExtractItemCondition[]): string[] {
  if (!Array.isArray(screened)) return [];
  return screened.flatMap((entry): string[] => {
    const shown = objectValue(entry);
    const where = shown?.where;
    const condition = typeof where === "number" ? conditions[where] : undefined;
    if (shown === undefined || condition === undefined) return [];
    const rows = [shown.rowsAlone, shown.rowsWithOthers, shown.rows].flatMap((list) => (Array.isArray(list) ? list : []));
    const sentence = webNodeNumericTextFilterSentence(where as number, condition, rows);
    return sentence === undefined ? [] : [sentence];
  });
}

function row(sampled: WebAutomationExtractionRejectedRow): JsonObject {
  return { ...sampled } as JsonObject;
}

function objectValue(value: JsonValue | undefined): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : undefined;
}
