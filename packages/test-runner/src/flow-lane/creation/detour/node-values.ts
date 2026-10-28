import type { FlowNodeRecord } from "../../flow-action-types.js";
import { normalizedText } from "./normalized-text.js";

/** The normalized values a node types or chooses: its `text`/`value` parameters and a select's named option. */
export function nodeValues(node: FlowNodeRecord): string[] {
  const parameters = node.parameterValues;
  const values: string[] = [];
  for (const candidate of [parameters?.text, parameters?.value]) {
    const text = normalizedText(candidate);
    if (text !== undefined) values.push(text);
  }
  const option = parameters?.option;
  if (option && typeof option === "object" && !Array.isArray(option)) {
    const chosen = option as Record<string, unknown>;
    for (const candidate of [chosen.label, chosen.value]) {
      const text = normalizedText(candidate);
      if (text !== undefined) values.push(text);
    }
  }
  return values;
}
