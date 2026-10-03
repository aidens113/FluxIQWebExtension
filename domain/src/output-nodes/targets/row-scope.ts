// The row a For Each pass is on, applied to the control a node acts on (t195).
//
// Two callers, and they must agree exactly: the node implementation a Flow's
// loop runs (`../native-runtime.ts`), and the build's test of that loop, which
// sends each body step with the pass's row as `item`
// (`runtime/llm-evidence/node-run/replay.ts`, t252). A test that scoped a
// control differently from the Flow would prove a different Flow, which is how
// run `run-murwcaj0-40e56557` passed a test of one press while the stored loop
// was never run.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationRecordValues } from "./targets";

/**
 * The node's parameters with its recorded target scoped to the row a For Each
 * pass is on.
 *
 * A loop over an extraction's rows ran its body's click on the element the build
 * recorded, so every pass pressed the same card's control (live runs
 * `run-munnop9n-5475d593`, `run-munnyvbr-11c28a0f`). Core hands the pass's row
 * to a body node that declares the `item` input (`../definitions.ts`), as the
 * extraction's validated record: field key to string.
 *
 * The row replaces the recorded `element.context.record`, which named the row
 * the Flow was built on, with the row's own values. The page then accepts the
 * recorded control only inside a record holding every one of them
 * (`content/identity/record.ts`), and resolves the same control in that row
 * when the recorded selector answers with another (`resolve-target.ts`).
 *
 * Only where the build saw the control inside a repeated thing: a `record`, or
 * a `listPosition`. A recorded node carries the record it was recorded in; a
 * node a model built from a snapshot handle carries its list position, and the
 * record's words as well whenever the packet published them -- on look-alikes
 * and on the example of a control every row repeats (t193,
 * `runtime/llm-evidence/plan-resolution/element-identity.ts`). A record the
 * page keyed (`data-id` and the like) publishes no words, so such a node
 * carries the position alone, which is why the position is enough. A control
 * that sat in no repeated thing -- a dialog's Close, the page's search box --
 * is the same control on every pass and is dispatched untouched. So is
 * everything when no row arrived, the row is not an object, or it holds no
 * non-empty string; the parameters are then returned as the same object.
 */
export function webAutomationScopedToRow(parameters: JsonObject, item: JsonValue | undefined): JsonObject {
  if (!isJsonObject(item)) return parameters;
  const element = isJsonObject(parameters.element) ? parameters.element : undefined;
  const elementContext = element && isJsonObject(element.context) ? element.context : undefined;
  if (!element || !elementContext || !(isJsonObject(elementContext.record) || isJsonObject(elementContext.listPosition))) return parameters;
  const values = webAutomationRecordValues(Object.values(item));
  if (!values) return parameters;
  return { ...parameters, element: { ...element, context: { ...elementContext, record: { values } } } };
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
