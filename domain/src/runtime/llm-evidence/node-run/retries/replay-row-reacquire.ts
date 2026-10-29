// A row-bound step of a build's test finds its row again (t786, D7).
//
// A loop's body step is replayed with its pass's row, scoped onto its control
// (`output-nodes/targets/row-scope.ts`): the page accepts the control only in a
// record holding every one of the row's values. When the page has redrawn the
// list since the read -- a count went up, a time moved on -- no record holds
// them any more and every retry fails not found although the item is there.
// So, once Core asks: the read the row came from (`./replayed-reads.ts`) is
// sent again, read-only and once, exactly as it was replayed; the row is
// matched among its fresh rows by identity (`runtime/target-reacquire/`); and
// the step is scoped to the fresh row for its remaining attempts.
//
// A read that cannot be re-run, fails, or answers no rows is `unavailable`,
// never `gone`: an empty answer may be a half-drawn page.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationScopedToRow } from "../../../../output-nodes";
import { webReacquireRow, webReacquireRowKeyColumns } from "../../../target-reacquire";
import { isJsonRecord } from "../../untrusted-json";
import type { WebNodeRun } from "../context";
import type { WebNodeReacquire } from "./reacquire";
import { webNodeReplayedReads } from "./replayed-reads";

/**
 * How the step `parameters` (resolved, as dispatched) finds its pass's row
 * `item` again, or nothing for a step with no row or no control to scope.
 * `readRows` reads a list read's rows off its answer, as the replay stores them.
 */
export function webNodeReplayRowReacquire(
  run: Pick<WebNodeRun, "gateway" | "sessionId" | "stores" | "request">,
  input: { item: JsonValue | undefined; parameters: JsonObject; metadata: JsonObject; readRows: (parameters: JsonObject, payload: JsonValue | undefined) => JsonObject | undefined }
): WebNodeReacquire | undefined {
  const { item, parameters } = input;
  if (!isJsonRecord(item) || !isJsonRecord(parameters.element)) return undefined;
  return async () => {
    const source = webNodeReplayedReads(run).sourceOf(item);
    if (source === undefined) return { outcome: "unavailable" };
    const reread = await run.gateway.executeAction(run.sessionId, { ...source.command, metadata: input.metadata });
    if (reread.status !== "succeeded") return { outcome: "unavailable" };
    const records = input.readRows(source.parameters, reread.payload as JsonValue | undefined)?.records;
    const rows = Array.isArray(records) ? records.filter(isJsonRecord) : [];
    if (rows.length === 0) return { outcome: "unavailable" };
    const found = webReacquireRow({ stale: item, candidates: rows, keyColumns: webReacquireRowKeyColumns(source.parameters, item) });
    if (found.outcome === "found") return { outcome: "found", parameters: webAutomationScopedToRow(parameters, found.value) };
    return found.outcome === "gone" ? { outcome: "gone" } : { outcome: "unmatched" };
  };
}
