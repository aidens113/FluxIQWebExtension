import path from "node:path";
import { chartNodeKind } from "../chart/index.js";
import type { ChartFlow, ChartLoop, ChartNode, ChartParameter, ChartRead } from "../chart/index.js";
import type { DraftStep } from "./draft-step.js";
import { isSavedFlow } from "./is-saved-flow.js";
import { latestFlowDraft } from "./latest-flow-draft.js";
import { readChartOutput } from "./chart-output.js";
import { readNodeResults, type NodeRead } from "./node-results.js";
import { readRunInstruction } from "./run-instruction.js";
import { isSecretLabel, redactChartText } from "../redact-chart-text.js";
import { shortenChartText } from "../shorten-chart-text.js";

const MAX_VALUE = 90;

function parametersOf(step: DraftStep): Record<string, unknown> {
  return (step.input?.parameters ?? {}) as Record<string, unknown>;
}

/** The value a step typed or chose: its words, with a secret field's value hidden. */
function typedOf(step: DraftStep): string | undefined {
  const given = step.does?.text ?? (typeof parametersOf(step).value === "string" ? parametersOf(step).value as string : undefined);
  if (given === undefined) return undefined;
  return shortenChartText(isSecretLabel(step.does?.target) ? "[hidden]" : redactChartText(given), MAX_VALUE);
}

/** What went through a node, from the run's record of it: the address it went to, or the rows a read found and the first row. */
function exampleOf(step: DraftStep, read: NodeRead | undefined): string[] {
  const url = parametersOf(step).url;
  const lines = typeof url === "string" ? [`went to ${shortenChartText(redactChartText(url), MAX_VALUE)}`] : [];
  if (read === undefined) return lines;
  const asked = Object.keys(((parametersOf(step).extractList as { fields?: Record<string, unknown> } | undefined)?.fields) ?? {});
  const row = read.firstRow ?? {};
  const keys = (asked.length > 0 ? asked.filter((key) => key in row) : Object.keys(row)).slice(0, 6);
  lines.push(`${read.recordCount ?? "some"} row${read.recordCount === 1 ? "" : "s"} read`);
  if (keys.length > 0) lines.push(`first row: ${keys.map((key) => `${key}: ${shortenChartText(redactChartText(String(row[key] ?? "")), 40)}`).join(" | ")}`);
  return lines;
}

/**
 * The Flow the run holds, charted from its step files alone: the newest draft's steps that are in the Flow (nothing dropped
 * or merged), what the run recorded going through each, the instruction typed to the chat and the result the attempt returned.
 * `null` when the run never held a draft.
 */
export async function readChartFlow(from: string | ChartRead): Promise<ChartFlow | null> {
  const { runDirectory, stepsDirectory, evidenceDirectory = runDirectory, attempt, saved }: ChartRead = typeof from === "string" ? { runDirectory: from } : from;
  const steps = stepsDirectory ?? path.join(runDirectory, "steps");
  const draft = await latestFlowDraft(steps);
  if (draft === null) return null;
  const inFlow = draft.filter((step) => step.inResult === true);
  const shown = inFlow.length > 0 ? inFlow : draft;
  const reads = await readNodeResults(steps, new Set(shown.flatMap((step) => (step.callId && /extract_list/u.test(step.actionId) ? [step.callId] : []))));
  const lastRead = [...shown].reverse().find((step) => /extract_list/u.test(step.actionId));
  const nodes: ChartNode[] = shown.map((step) => {
    const typed = typedOf(step);
    return {
      step: step.step, kind: chartNodeKind(step.actionId),
      ...(step.does?.target ? { target: shortenChartText(redactChartText(step.does.target), MAX_VALUE) } : {}),
      ...(typed === undefined ? {} : { typed }),
      example: exampleOf(step, step.callId ? reads.get(step.callId) : undefined),
      ...(step.act ? { act: step.act } : {}),
      result: step === lastRead,
    };
  });
  const loops: ChartLoop[] = shown.flatMap((step) => {
    const through = /repeats through step (\d+)/u.exec(step.runs ?? "")?.[1];
    return through === undefined ? [] : [{ from: step.step, to: Number(through), label: `repeats over ${step.does?.target ?? "its list"} until nothing more` }];
  });
  const parameters: ChartParameter[] = shown.flatMap((step) => {
    const typed = typedOf(step);
    return typed !== undefined && (step.bindable ?? []).some((name) => name === "text" || name === "value") ? [{ name: `${step.does?.target ?? chartNodeKind(step.actionId)} (step ${step.step})`, value: typed }] : [];
  });
  const instruction = await readRunInstruction(steps);
  return {
    source: (saved ?? await isSavedFlow(evidenceDirectory)) ? "saved Flow" : "draft",
    ...(attempt === undefined ? {} : { attempt }),
    instruction: instruction === null ? null : redactChartText(instruction),
    parameters, nodes, loops, branches: [],
    otherSteps: inFlow.length > 0 ? draft.length - inFlow.length : 0,
    output: await readChartOutput(evidenceDirectory, steps),
  };
}
