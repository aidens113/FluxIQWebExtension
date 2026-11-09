// The record output an extraction step saves is the one its dispatch runs
// (t510, F1).
//
// Breadth wave 1's auction run (`run-mv6qrbgx-06151cdb`, steps 0022 to 0026)
// sorted by an end time the answer must not show: the schema listed the four
// answer columns and every helper marked `handling: "exclude"`, and
// `process.columns` named the four. The resolver kept the record output as the
// model wrote it, so Core's plan validation refused the sort on an excluded
// field. The dispatch, which replaces the schema with the read's own
// (`output-nodes/extract-list/reconciled-record-output.ts`), would have run it.
// Two readers of one value disagreed, the class t489 closed for unknown names
// (`./stored-columns.ts`), and the build spent its refusals on the wrong fix.
//
// **So there is one reader.** Once the step's parameters are final and its dry
// dispatch accepts them (`webPlanUndispatchable`), the record output the step
// keeps is the one that dispatch built: the same reconcile, the same narrowing
// to the declared columns (a helper `process` needs stored and hidden), the same
// processing from the read, the same records path, as Core's parser read it.
// Core then validates what will run, and the Flow saves it. Dispatching that
// value again builds the same value, so a saved Flow runs unchanged.
//
// A step with no record output keeps none: the dispatch derives one each run,
// and writing it would put a dataset the model never named into its Flow. A
// step its dispatch refuses is left as written; the resolver has refused it
// already.
//
// **A column the saved read drops that nothing uses is said (t877).** Run
// `run-mw49972k-cebf67e5` saved a read of title and price under a schema of
// title alone -- Core's build had cut the instruction's column list short --
// and price left the saved read with `ok: true` and no word anywhere. The
// answer keeps exactly the declared columns, but here, where the Flow's record
// output is fixed, one step-log note names each column of the read the schema
// dropped that no condition, sort or dedupe uses (`droppedColumns`,
// `output-nodes/extract-list/declared-columns.ts`). Column names only, never a
// cell value; nothing when none is dropped. This module runs in the host, never
// in the extension's bundle, so it may write the note.

import { automationStudioLlmStepLogNote } from "fluxiq/automation";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationExtractListDispatch } from "../../../../output-nodes";

/** The step's parameters with `recordOutput` as its dispatch runs it, or the parameters unchanged (header). */
export function webPlanRunRecordOutput(parameters: JsonObject): JsonObject {
  if (!isJsonObject(parameters.recordOutput)) return parameters;
  const dispatch = webAutomationExtractListDispatch(parameters);
  if (!dispatch.ok || !isJsonObject(dispatch.payload.recordOutput)) return parameters;
  if (dispatch.droppedColumns?.length) {
    automationStudioLlmStepLogNote(`A saved read drops ${dispatch.droppedColumns.length === 1 ? "a column" : "columns"} it was written with that nothing uses, because its declared columns leave ${dispatch.droppedColumns.length === 1 ? "it" : "them"} out: ${dispatch.droppedColumns.join(", ")}.`);
  }
  return { ...parameters, recordOutput: dispatch.payload.recordOutput };
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
