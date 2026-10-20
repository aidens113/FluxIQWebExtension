import type { JsonObject } from "fluxiq/core";
import type { InstalledBuild } from "./installed-build";

/** One evidence entry the build loop showed the provider. */
export type ScriptedEntry = { callId: string; toolId: string; value: JsonObject };

/** A provider answer: one decision of the evidence loop, at no cost. */
export type ScriptedAnswer = ReturnType<typeof answer>;

const record = (value: unknown): JsonObject => typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonObject : {};

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2, estimatedCostUsd: 0 };

function answer(decision: JsonObject) {
  return { response: { kind: "evidence_tool_decision", summary: "Provider-free transport diagnostic", decision }, usage };
}

/** One builder turn: what the loop showed, and the decisions a script may answer with. */
export type BuilderTurn = {
  /** The builder's turn, from 1. */
  step: number;
  evidence: ScriptedEntry[];
  /** The newest answer of `toolId`. */
  last: (toolId: string) => JsonObject | undefined;
  /** The newest full page the loop showed, as text. */
  shownPage: () => string;
  /** Whether the newest page shown came from the newest entry. */
  shownIsLatest: () => boolean;
  call: (callId: string, toolId: string, input: JsonObject) => ScriptedAnswer;
  /** A `core.run_node` call: its node, parameters, declared consequences, and extra inputs such as `undoes` or `resetDestination`. */
  node: (callId: string, name: string, parameters: JsonObject, consequences?: string[], extra?: JsonObject) => ScriptedAnswer;
  complete: (result: JsonObject) => ScriptedAnswer;
};

export type ScriptedProviderOptions = {
  task: string;
  permitted: string[];
  instructionSourceId: () => string;
  maxIterations: number;
  maxCallsPerRun: number;
  builder: (turn: BuilderTurn) => ScriptedAnswer | Promise<ScriptedAnswer>;
};

/** What the scripted supervisor saw each of its calls answer, and how many turns each role took. */
export type ScriptedProvider = {
  receipts: Array<{ call: string; code: unknown }>;
  supervisorSteps: () => number;
  builderSteps: () => number;
};

/**
 * A scripted, provider-free model for one project build: the supervisor
 * writes a one-part plan and dispatches one build brief, every trial's
 * verification answers yes, and each builder turn is the spec's script. No
 * model is ever called and every answer costs nothing.
 */
export function bindScriptedProvider(build: Pick<InstalledBuild, "service">, options: ScriptedProviderOptions): ScriptedProvider {
  let supervisorStep = 0, builderStep = 0;
  const receipts: Array<{ call: string; code: unknown }> = [];
  build.service.bindLlmExecutionProvider(() => ({ provider: {
    metadata: { provider: "scripted", model: "provider-free" },
    runTask: async request => {
      if (request.taskKind === "loop_verification") return { response: { kind: "diagnosis", summary: "Diagnostic trial completed.", diagnosis: { answersRequest: "yes" } }, usage };
      const loop = request.context.evidenceLoop;
      const tools = (loop?.tools ?? []).map(tool => tool.toolId);
      const evidence = (loop?.evidence ?? []) as ScriptedEntry[];
      if (!tools.length) return answer({ kind: "tool_call", callId: "read", toolId: "none", input: {} });
      const last = (toolId: string) => [...evidence].reverse().find(entry => entry.toolId === toolId)?.value;
      const call = (callId: string, toolId: string, input: JsonObject) => answer({ kind: "tool_call", callId, toolId, input });
      if (tools.includes("project.write_plan")) {
        supervisorStep++;
        const previous = evidence.at(-1);
        if (previous) receipts.push({ call: previous.toolId, code: previous.value.code ?? (previous.value.ok === true ? "ok" : "unknown") });
        if (supervisorStep === 1) {
          const part = { id: "p1", quote: { sourceId: options.instructionSourceId(), text: options.task }, goalFacts: ["A new line exists"], lastingActs: options.permitted };
          return call("plan", "project.write_plan", { taskSpec: { parts: [part], notAsked: [] }, subflows: [{ key: "main", name: "New line", parts: ["p1"] }] });
        }
        if (supervisorStep === 2) {
          const brief = { kind: "build", subflowKey: "main", parts: ["p1"], entry: { caseId: "observed-current", predecessors: [] }, permittedActs: options.permitted, maxIterations: options.maxIterations };
          return call("dispatch", "project.dispatch", { reason: "Exercise the transport.", briefs: [brief] });
        }
        return answer({ kind: "complete", result: record(last("project.dispatch")?.complete) });
      }
      const shown = () => [...evidence].reverse().map(entry => entry.value).find(value => typeof value.page === "string");
      builderStep++;
      return options.builder({
        step: builderStep,
        evidence,
        last,
        shownPage: () => String(shown()?.page ?? ""),
        shownIsLatest: () => evidence.at(-1)?.value === shown(),
        call,
        node: (callId, name, parameters, consequences = [], extra = {}) => call(callId, "core.run_node", { node: name, parameters, consequences, ...extra }),
        complete: result => answer({ kind: "complete", result })
      });
    }
  }, maxCallsPerRun: options.maxCallsPerRun, maxEstimatedCostUsd: 0.1 }));
  return { receipts, supervisorSteps: () => supervisorStep, builderSteps: () => builderStep };
}
