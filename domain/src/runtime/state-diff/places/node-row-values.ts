// The pass row a scoped node carries (`./scoped-node.ts`): the values
// `webAutomationScopedToRow` wrote into its recorded `element.context.record`,
// already collapsed and cut as the page compares them. A node no pass scoped
// carries none.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { webNodeTargetParameters } from "./target-parameters";

/** The pass row's values on the node's target, or `undefined` when it carries none. */
export function webNodeRowValues(node: { definitionId: string; parameterValues?: JsonObject | undefined }): readonly string[] | undefined {
  const element = record(webNodeTargetParameters(node)?.element);
  const recorded = record(record(element?.context)?.record);
  const values = recorded?.values;
  if (!Array.isArray(values)) return undefined;
  const strings = values.filter((value): value is string => typeof value === "string" && value !== "");
  return strings.length > 0 ? strings : undefined;
}

function record(value: JsonValue | undefined): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}
