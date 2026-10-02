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
// the 20 hide. So each condition says `alone` (how many it removed alone) and
// `rowsAlone`, and the read carries one sentence telling the model which to
// check (`WEB_NODE_REJECTED_ROWS_NOTE`). A page build that does not order its
// rows says `rows` per condition as before.
//
// **Every row is said once** (run 13, `run-muqbzu32-8691a65e`, F40). Until then
// a row three conditions rejected was listed under each of the three, every
// field whole, each link a 200-character address: of `rerun.13`'s 74,330
// characters, 52,201 were `rejectedRows`, and the request grew by a read each
// decision until the build ran out of money. So `rejectedRows` is one object:
// `fields`, the column names once; `conditions`, each with its counts and its
// `rowsAlone`; `rowsWithOthers`, every row more than one condition rejected,
// once, grouped by the conditions it `failed`. A row is its values in the
// order of `fields`. No row and no count is left out: only the repetition goes.
//
// **Links are written from the page's origin, stated once for the read**
// (t194 w48). F40 wrote them from `~`, as the page view does, with `~` stated
// inside `rejectedRows`. A read now writes its kept rows and these with one
// writer (`./shown-rows/links.ts`), as paths from the origin the read states once as
// its `origin` (`./shown-rows/account.ts`), so a link here is also an address the
// rule on where a build may navigate can read (`./shown-addresses.ts`).
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
import { webNodeReadLinks, webNodeReadOutcome, type WebNodeReadLinks } from "./shown-rows";

/** The only verb whose rows a condition decides. */
const EXTRACT_LIST_ACTION = "web.dom.extract_list";

/** The one sentence the model is given beside `rejectedRows`, when some condition removed rows alone. */
export const WEB_NODE_REJECTED_ROWS_NOTE = "In rejectedRows, each row is its values in the order of fields; a condition's rowsAlone are rows it removed by itself (every other condition kept them): check each against the instruction, and if any is a row the instruction asks for, that condition is wrong and must change; rowsWithOthers lists once each row more than one condition rejected, under the conditions it failed.";

/**
 * One condition's rejected rows as they are gathered: `rowsAlone` from a page
 * that ordered them (its other rows go to the read's `rowsWithOthers`), `rows`
 * from one that did not.
 */
type WebNodeRejectedRowsEntry = {
  where: number;
  rejected: number;
  alone?: number | undefined;
  rows?: JsonObject[] | undefined;
  rowsAlone?: JsonObject[] | undefined;
};

/** The rows the same conditions, and no single one alone, rejected. */
type WebNodeRejectedRowsGroup = { failed: number[]; rows: JsonObject[] };

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
 * `parameters` are the ones the node ran with. Given, a text condition that
 * compares digits by text (`./numeric-text-filter.ts`, run 36) adds one
 * sentence to the note: a bound reads "Aisha Khan and 4 other mutual friends"
 * as 5, a pattern does not.
 */
export function webNodeReadWithRejectedRows(payload: JsonValue | undefined, parameters?: JsonObject): WebNodeReadWithRejectedRows {
  const recorded = withoutSamples(payload);
  // One writer for the whole read, so its kept rows and its rejected rows state one origin (`./shown-rows/links.ts`).
  const links = webNodeReadLinks(objectValue(payload)?.url);
  const shown = rejectedRows(payload, conditionsRan(parameters), links);
  // The page's own record never reaches the model (`./page-record.ts`); the
  // replay keeps the payload as the node answered it.
  const read = webNodeReadResult(webNodeWithoutPageRecord(recorded));
  if (shown === undefined) return { read: webNodeReadOutcome(read, links), recorded };
  const beside = present<WebNodeRejectedRowsBeside>({ rejectedRows: shown.rows, rejectedRowsNote: note(shown) }) as JsonObject;
  if (read === undefined) return { read: beside, recorded };
  if (typeof read !== "object" || read === null || Array.isArray(read)) return { read, recorded };
  return { read: webNodeReadOutcome({ ...read, ...beside }, links), recorded };
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
 * many it rejected, how many of those it removed alone, and the rows it removed
 * alone; and once, for the whole read, every row more than one condition
 * rejected, under the conditions it failed. `anyAlone` is whether any condition
 * has an alone row to check.
 *
 * A row is the same row wherever its values are the same, which is how the page
 * already says an identical row once (`content/extraction/rejected-samples.ts`).
 *
 * The samples are read through the summary's own copy, so only the read's
 * declared fields arrive, every row the page rejected, whole; the same screen
 * as the kept rows then drops a key Core denies in evidence and withholds a
 * credential-shaped string (`./read-result.ts`).
 */
function rejectedRows(payload: JsonValue | undefined, conditions: readonly WebAutomationExtractItemCondition[] | undefined, links: WebNodeReadLinks): ShownRejectedRows | undefined {
  const whole = objectValue(payload);
  const summary = webAutomationExtractionSummaryValue(whole?.extraction);
  const samples = summary?.rejectedSamples;
  const counts = summary?.conditions?.rejected;
  if (samples === undefined || counts === undefined) return undefined;
  const leads = summary?.rejectedSamplesAlone;
  const aloneCounts = summary?.conditions?.alone;
  let anyAlone = false;
  const withOthers = new Map<string, { row: JsonObject; failed: number[] }>();
  const entries: JsonObject[] = samples.flatMap((sampled, index): JsonObject[] => {
    if (sampled.length === 0) return [];
    const rejected = counts[index] ?? sampled.length;
    const lead = leads?.[index];
    if (lead !== undefined && lead > 0) anyAlone = true;
    for (const other of lead === undefined ? [] : sampled.slice(lead)) {
      const key = JSON.stringify(other);
      const said = withOthers.get(key) ?? { row: writtenRow(other, links), failed: [] };
      said.failed.push(index);
      withOthers.set(key, said);
    }
    const alone = lead === undefined ? [] : sampled.slice(0, lead);
    // A page build that did not order its rows says every row, unsplit.
    return [present<WebNodeRejectedRowsEntry>({
      where: index,
      rejected,
      alone: aloneCounts?.[index] ?? lead,
      rows: lead === undefined ? sampled.map((row) => writtenRow(row, links)) : undefined,
      rowsAlone: alone.length === 0 ? undefined : alone.map((row) => writtenRow(row, links))
    }) as JsonObject];
  });
  if (entries.length === 0) return undefined;
  const screened = objectValue(webNodeReadResult(present<{ conditions: JsonObject[]; rowsWithOthers?: JsonObject[] | undefined }>({
    conditions: entries,
    rowsWithOthers: withOthers.size === 0 ? undefined : groups(withOthers)
  }) as JsonObject));
  if (screened === undefined) return undefined;
  return { rows: tabulated(screened), anyAlone, numeric: conditions === undefined ? [] : numericSentences(screened, conditions) };
}

/** The rows more than one condition rejected, one group per set of conditions, in the order of those sets. */
function groups(withOthers: ReadonlyMap<string, { row: JsonObject; failed: number[] }>): JsonObject[] {
  const bySet = new Map<string, WebNodeRejectedRowsGroup>();
  for (const { row, failed } of withOthers.values()) {
    const key = failed.join(",");
    const group = bySet.get(key) ?? { failed, rows: [] };
    group.rows.push(row);
    bySet.set(key, group);
  }
  return [...bySet.values()].sort((a, b) => compareSets(a.failed, b.failed)) as unknown as JsonObject[];
}

function compareSets(a: readonly number[], b: readonly number[]): number {
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return a.length - b.length;
}

/** One sampled row with each address on the read's origin written from it (`./shown-rows/links.ts`). */
function writtenRow(sampled: WebAutomationExtractionRejectedRow, links: WebNodeReadLinks): JsonObject {
  return Object.fromEntries(Object.entries(sampled).map(([key, value]) => [key, value === null ? null : links.write(value)])) as JsonObject;
}

/**
 * The screened rows as the model is shown them: the column names once, as
 * `fields`, and each row its values in that order, `null` for a column it
 * does not hold.
 */
function tabulated(screened: JsonObject): JsonObject {
  const fields: string[] = [];
  const lists = rowLists(screened);
  for (const list of lists) for (const row of list) for (const key of Object.keys(objectValue(row) ?? {})) if (!fields.includes(key)) fields.push(key);
  // Every member that holds rows says them as values; every other member is as screened.
  const asValues = (holder: JsonValue | undefined): JsonObject => {
    const out: JsonObject = {};
    for (const [key, value] of Object.entries(objectValue(holder) ?? {})) {
      out[key] = ROW_LISTS.includes(key) && Array.isArray(value) ? value.map((row) => fields.map((field) => objectValue(row)?.[field] ?? null)) : value;
    }
    return out;
  };
  const out: JsonObject = {};
  out.fields = fields;
  out.conditions = arrayOf(screened.conditions).map(asValues);
  if (screened.rowsWithOthers !== undefined) out.rowsWithOthers = arrayOf(screened.rowsWithOthers).map(asValues);
  return out;
}

/** The members of a condition or a group that hold rows. */
const ROW_LISTS: readonly string[] = ["rows", "rowsAlone"];

/** Every list of rows the screened rejected rows hold. */
function rowLists(screened: JsonObject): JsonValue[][] {
  const lists: JsonValue[][] = [];
  for (const entry of [...arrayOf(screened.conditions), ...arrayOf(screened.rowsWithOthers)]) {
    const holder = objectValue(entry);
    for (const key of ROW_LISTS) {
      const list = holder?.[key];
      if (Array.isArray(list)) lists.push(list);
    }
  }
  return lists;
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

/** One sentence per shown condition that compares digits by text in a column whose rejected rows read as numbers. */
function numericSentences(screened: JsonObject, conditions: readonly WebAutomationExtractItemCondition[]): string[] {
  const others = arrayOf(screened.rowsWithOthers).map(objectValue);
  return arrayOf(screened.conditions).flatMap((entry): string[] => {
    const shown = objectValue(entry);
    const where = shown?.where;
    const condition = typeof where === "number" ? conditions[where] : undefined;
    if (shown === undefined || condition === undefined) return [];
    const failedWithOthers = others.flatMap((group) => (arrayOf(group?.failed).includes(where as number) ? arrayOf(group?.rows) : []));
    const rows = [...arrayOf(shown.rowsAlone), ...failedWithOthers, ...arrayOf(shown.rows)];
    const sentence = webNodeNumericTextFilterSentence(where as number, condition, rows);
    return sentence === undefined ? [] : [sentence];
  });
}

function arrayOf(value: JsonValue | undefined): JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function objectValue(value: JsonValue | undefined): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : undefined;
}
