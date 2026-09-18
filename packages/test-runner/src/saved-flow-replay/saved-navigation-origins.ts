// Where a saved Flow will send the browser. A Flow's navigate node carries an
// absolute address (`domain/src/output-nodes/payloads.ts`), so whether a
// replay can work at all depends on the fixture being served where the Flow
// was built. Origins only: the path and query stay in Core.

import type { FlowNodeRecord } from "../flow-lane/index.js";

const NAVIGATE_OUTPUT_ID = "web.browser.navigate";

/**
 * The distinct origins of the saved Flow's navigate nodes, in node order.
 * `actionTypes` is `createdFlowActionTypes` of the same nodes. A navigate node
 * whose address is missing or not a URL is reported as `(unreadable)` rather
 * than skipped, so it cannot pass for a Flow that navigates nowhere.
 */
export function savedNavigationOrigins(nodes: readonly FlowNodeRecord[], actionTypes: ReadonlyMap<string, string>): string[] {
  const origins: string[] = [];
  for (const node of nodes) {
    if (actionTypes.get(node.id) !== NAVIGATE_OUTPUT_ID) continue;
    const origin = originOf(parametersOf(node)?.url);
    if (!origins.includes(origin)) origins.push(origin);
  }
  return origins;
}

/** A node's action parameters, nested under `parameters` on a policy action node or flat on a domain output node. */
function parametersOf(node: FlowNodeRecord): Record<string, unknown> | undefined {
  const values = node.parameterValues;
  if (!values) return undefined;
  const nested = values.parameters;
  return typeof nested === "object" && nested !== null && !Array.isArray(nested) ? nested as Record<string, unknown> : values;
}

function originOf(value: unknown): string {
  if (typeof value !== "string") return "(unreadable)";
  try { return new URL(value).origin; }
  catch { return "(unreadable)"; }
}
