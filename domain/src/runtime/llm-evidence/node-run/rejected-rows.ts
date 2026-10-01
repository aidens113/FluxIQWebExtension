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
  WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_KEY,
  type WebAutomationExtractionRejectedRow
} from "../../../actions/extraction";
import { webNodeReadResult } from "./read-result";

/** The only verb whose rows a condition decides. */
const EXTRACT_LIST_ACTION = "web.dom.extract_list";

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
 * down -- and the payload with the samples taken out.
 *
 * Nothing is fitted to a byte budget (t200): the samples are as many as the
 * page's sampling returned (`actions/extraction/rejected-samples.ts`), and both
 * halves pass the same screen, so a denied key or a credential-shaped string is
 * withheld from the samples exactly as it is from the kept rows.
 */
export function webNodeReadWithRejectedRows(payload: JsonValue | undefined): WebNodeReadWithRejectedRows {
  const recorded = withoutSamples(payload);
  const shown = rejectedRows(payload);
  const read = webNodeReadResult(recorded);
  if (shown === undefined) return { read, recorded };
  if (read === undefined) return { read: { rejectedRows: shown }, recorded };
  if (typeof read !== "object" || read === null || Array.isArray(read)) return { read, recorded };
  return { read: { ...read, rejectedRows: shown }, recorded };
}

/** The payload with `extraction.rejectedSamples` removed, and unchanged when it carries none. */
function withoutSamples(payload: JsonValue | undefined): JsonValue | undefined {
  const whole = objectValue(payload);
  const extraction = objectValue(whole?.extraction);
  if (whole === undefined || extraction === undefined || !Object.hasOwn(extraction, WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_KEY)) return payload;
  const rest: JsonObject = {};
  for (const [key, value] of Object.entries(extraction)) if (key !== WEB_AUTOMATION_EXTRACT_REJECTED_SAMPLES_KEY) rest[key] = value;
  return { ...whole, extraction: rest };
}

/**
 * Each condition that turned rows down, by its position in `where`, with how
 * many it rejected and every row the page sampled for it.
 *
 * The samples are read through the summary's own copy, so only the read's
 * declared fields arrive, every row the page rejected, whole; the same screen
 * as the kept rows then drops a key Core denies in evidence and withholds a
 * credential-shaped string (`./read-result.ts`).
 */
function rejectedRows(payload: JsonValue | undefined): JsonValue | undefined {
  const summary = webAutomationExtractionSummaryValue(objectValue(payload)?.extraction);
  const samples = summary?.rejectedSamples;
  const counts = summary?.conditions?.rejected;
  if (samples === undefined || counts === undefined) return undefined;
  const shown: JsonObject[] = samples.flatMap((sampled, index) => sampled.length === 0
    ? []
    : [{ where: index, rejected: counts[index] ?? sampled.length, rows: sampled.map(row) }]);
  return shown.length === 0 ? undefined : webNodeReadResult(shown);
}

function row(sampled: WebAutomationExtractionRejectedRow): JsonObject {
  return { ...sampled } as JsonObject;
}

function objectValue(value: JsonValue | undefined): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : undefined;
}
