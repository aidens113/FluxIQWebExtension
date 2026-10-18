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
 * The row's own values are written into the recorded `element.context.record`
 * as `values`. The page then accepts the recorded control only inside a record
 * holding every one of them (`content/identity/record.ts`), and resolves the
 * same control in that row when the recorded selector answers with another
 * (`resolve-target.ts`). A `key` or `text` the record already carried, which
 * named the row the Flow was built on, stays beside the values: the values
 * outrank both on the page, and their presence is what tells the page the build
 * saw the control inside a repeated thing.
 *
 * **Every element target gets the row, not only one the build saw in a row.**
 * This used to scope only a control whose identity carried a
 * `record` or a `listPosition`, and dispatch every other one untouched, on the
 * reading that such a control -- a dialog's Close, the page's search box -- is
 * the same control on every pass. But whether an identity carries either is a
 * fact about what the packet published, not about the page: a card drawn as
 * `[role=article]` inside a `[role=feed]` has no list position, and a control
 * the packet did not single out as a look-alike carries no record words. Live
 * run `run-mvd0qwhi-5f7dbf80` read five posts and clicked each one's "Hide
 * post" with `repeat over`; the saved identity was `{ landmark: "main" }`
 * beside a positional selector, so the row was dropped here, pass 1 hid the
 * post the build had looked at instead of row 1, and pass 2, with that post
 * gone, met eleven identical "Hide post" buttons and failed
 * `web.target.ambiguous` in every trial. Only the page can tell a per-row
 * control from a page-level one, so the page decides: a target whose row came
 * with no recorded row evidence -- no record key or text, no list position --
 * is resolved first as recorded, acted on there only if that answer sits in no
 * repeated row, and otherwise resolved inside the pass's row, never another
 * (`content/action-runtime/pass-row/`).
 *
 * Nothing changes when no row arrived, the row is not an object, it holds no
 * non-empty string, or the parameters name no recorded element at all; the
 * parameters are then returned as the same object.
 */
export function webAutomationScopedToRow(parameters: JsonObject, item: JsonValue | undefined): JsonObject {
  if (!isJsonObject(item)) return parameters;
  const element = isJsonObject(parameters.element) ? parameters.element : undefined;
  if (!element) return parameters;
  const values = webAutomationRecordValues(Object.values(item));
  if (!values) return parameters;
  const elementContext = isJsonObject(element.context) ? element.context : {};
  const recorded = isJsonObject(elementContext.record) ? elementContext.record : {};
  return { ...parameters, element: { ...element, context: { ...elementContext, record: { ...recorded, values } } } };
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
