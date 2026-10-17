// What each `where` condition of a list read did, as its draft statement tells
// Core (`conditions`, t693): per condition, in the order the read's `where`
// lists them, how many items it held of (`kept`) and rejected, and the few
// values it read on the rows the read kept.
//
// Core uses it to tell an unchanged rerun of the read which condition left out
// no row and what it read on those rows
// (`AS/runtime/llm/repeat-guard/narrowed-nothing.ts`). Run
// `run-mvbr0w7e-6a01c05b`'s repair resent one `is present` condition six times
// because nothing said every row met it.
//
// Made from the read's own summary (`actions/extraction/summary.ts`), so it
// says nothing the summary does not: `kept` is the items the conditions were
// asked about less the ones that condition rejected, and the values are the
// summary's `conditions.keptValues`, already in the read the model is shown
// (`../read-result.ts`), where Core checks each value is before carrying it. A
// read with no conditions, or a page build that does not count them, sends
// none.

import type { JsonValue } from "fluxiq/core";
import { webAutomationExtractionSummaryValue } from "../../../../actions/extraction";
import type { WebLlmEvidenceToolExecution } from "../../capture";
import { isJsonRecord } from "../../untrusted-json";

/** The node that reads a list (`../call-words.ts` names it the same way). */
const LIST_NODE = "web.output.dom-extract_list";

/** The account as a draft statement states it. */
type WebListReadConditionAccount = NonNullable<NonNullable<WebLlmEvidenceToolExecution["draft"]>["conditions"]>;

/**
 * The account a read of `nodeId` answering `payload` states, or `undefined` for
 * any other node and for a read whose summary counts no condition.
 */
export function webListReadConditionAccount(nodeId: string, payload: JsonValue | undefined): WebListReadConditionAccount | undefined {
  if (nodeId !== LIST_NODE || !isJsonRecord(payload)) return undefined;
  const report = webAutomationExtractionSummaryValue(payload.extraction)?.conditions;
  if (report === undefined || report.rejected.length === 0) return undefined;
  return report.rejected.map((rejected, index) => ({
    kept: Math.max(report.applied - rejected, 0),
    rejected,
    keptValues: [...(report.keptValues?.[index] ?? [])]
  }));
}
