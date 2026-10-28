import type { FlowNodeRecord } from "../../flow-action-types.js";
import { normalizedText } from "./normalized-text.js";

// Every text-like signal of a saved element fingerprint (`WebAutomationElementFingerprint`,
// built by `domain/src/element-fingerprint/build.ts`): the words a person would use to name the control.
const LABEL_FIELDS = ["visibleText", "text", "label", "accessibleName"] as const;
const LABEL_ATTRIBUTES = ["aria-label", "title"] as const;

/** The normalized words that name the control a node acts on; empty when the node holds no readable target. */
export function nodeLabels(node: FlowNodeRecord): string[] {
  const parameters = node.parameterValues;
  const target = record(parameters?.target);
  const sources = [record(parameters?.element), record(target?.element), record(target?.fingerprint)];
  const labels: string[] = [];
  for (const element of sources) {
    if (!element) continue;
    for (const field of LABEL_FIELDS) push(labels, element[field]);
    const attributes = record(element.attributes);
    for (const attribute of LABEL_ATTRIBUTES) push(labels, attributes?.[attribute]);
  }
  return labels;
}

function push(labels: string[], value: unknown): void {
  const text = normalizedText(value);
  if (text !== undefined && !labels.includes(text)) labels.push(text);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
