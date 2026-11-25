import type { ScriptedModelTool } from "./wire-request.js";

/** The one tool call a decision is sent as: the request's own tool name, and its input. */
export type ScriptedModelToolCall = Readonly<{ name: string; input: Record<string, unknown> }>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const NOT_NAME = /[^A-Za-z0-9_-]/gu;

/**
 * A script's decision, `{ kind: "evidence_tool_decision", summary, decision: { kind, toolId?, ... } }`, as the
 * native tool call it is answered with. The tool is found in the request's own tool list and never named here:
 * a tool call by the offered tool id its description says it calls, any other decision by the decision kind its
 * name is written from (a clash suffix `_2` allowed). The input is the decision without `kind` and `toolId`,
 * under the wrapper's `summary`, exactly what Core reads back. Throws when the request offers no such tool,
 * which fails the run naming it, rather than answering with something Core would refuse.
 */
export function scriptedModelToolCall(value: unknown, tools: readonly ScriptedModelTool[]): ScriptedModelToolCall {
  if (!isRecord(value) || !isRecord(value.decision) || typeof value.decision.kind !== "string") throw new Error("The scripted reply is not an evidence decision with a decision");
  const { kind, toolId, ...rest } = value.decision;
  const wanted = typeof toolId === "string" ? `the offered tool ${toolId} ` : undefined;
  const base = kind.replace(NOT_NAME, "_");
  const tool = wanted === undefined
    ? tools.find((candidate) => candidate.name === base || new RegExp(`^${base}_\\d+$`, "u").test(candidate.name))
    : tools.find((candidate) => candidate.description.includes(wanted));
  if (!tool) throw new Error(`The request offers no tool for the decision ${kind}${typeof toolId === "string" ? ` of ${toolId}` : ""}; it offers ${tools.map((candidate) => candidate.name).join(", ")}`);
  return { name: tool.name, input: { ...(value.summary === undefined ? {} : { summary: value.summary }), ...rest } };
}
