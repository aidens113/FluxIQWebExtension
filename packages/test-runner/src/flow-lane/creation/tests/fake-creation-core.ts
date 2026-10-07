// A Core that behaves like the one a created-Flow run drives, for the
// created-Flow lane's tests: a blank Flow on create, one instruction save, one
// evidence-guided build, a review that approves and applies, a graph Flow the
// apply wrote, and a run whose attempts and datasets the test chooses. Every
// call is logged by name, in order.

import type { ExistingFlowAdaptation } from "../../../existing-fluxiq-control.js";
import { RunnerFailure } from "../../../failure.js";
import type { CreatedFlowLaneControl } from "../lane.js";
import { PAGE_ONE_RECORDS } from "./scenario-fixture.js";
import { DEFAULT_LLM_MODEL } from "@fluxiq-web-extension/test-contracts";

export const PROJECT_ID = "project.lab";
export const FLOW_ID = "flow.created";
export const GRAPH_FLOW_ID = "flow.created.graph";
export const ADAPTATION_ID = "adaptation.created";

/** A Flow bootstrap's nodes: a start, a navigation and an extraction, each output a domain node fixes. */
export const EXTRACTING_NODES = [
  { id: "node.start", definitionId: "builtin.control.start" },
  { id: "node.open", definitionId: "web.output.browser-navigate", parameterValues: { url: "http://127.0.0.1/scenarios/product-catalog/" }, metadata: { outputActionId: "web.browser.navigate" } },
  { id: "node.extract", definitionId: "web.output.dom-extract_list", parameterValues: { selector: "[data-testid=\"card\"]", fields: { name: "[data-testid=\"name\"]" } }, metadata: { outputActionId: "web.dom.extract_list" } },
];

/** The edges joining `EXTRACTING_NODES`: start, then navigate, then extract. Labels and metadata, as Core may hold them, that the snapshot must not carry. */
export const EXTRACTING_EDGES = [
  { id: "edge.start-open", sourceNodeId: "node.start", sourcePortId: "out", targetNodeId: "node.open", targetPortId: "in", label: "Open the catalog page" },
  { id: "edge.open-extract", sourceNodeId: "node.open", targetNodeId: "node.extract", metadata: { note: "then read every card" } },
];

export type FakeCreationCoreOptions = {
  /** What the build answers: a proposal, a refusal envelope, or a request that outlives its bound. */
  generation?: { kind: "proposed" } | { kind: "refused"; status: number; payload: unknown } | { kind: "timeout"; proposalAfterPolls?: number } | { kind: "transport" };
  /** The pending proposal's evidence-loop audit; `null` for none. */
  evidenceLoop?: ExistingFlowAdaptation["evidenceLoop"] | null;
  /** What the proposal says its steps declared, and the question it carries out to a person. */
  consequences?: ExistingFlowAdaptation["consequences"];
  adaptationStatus?: string;
  instructionStatus?: string;
  appliedMutationCount?: number;
  /** What `create-flow` produced, as `get-flow` returns it. */
  blankFlow?: Record<string, unknown>;
  graphNodes?: readonly unknown[];
  /** The graph Flow's edges; `EXTRACTING_EDGES` unless a test says otherwise. */
  graphEdges?: readonly unknown[];
  attempts?: ReadonlyArray<{ nodeId: string; status: string }>;
  runStatus?: string;
  datasets?: ReadonlyArray<{ datasetId: string; nodeIds: string[]; rows: Array<Record<string, unknown>> }>;
  /** The asks on the Flow's own thread, as `get-conversation` returns them on turns. */
  flowThreadAsks?: ReadonlyArray<Record<string, unknown>>;
  /** The judged yes Core recorded on the proposal's created audit event (`buildJudged`), as `get-flow-adaptation` returns it raw; absent, none. */
  buildJudged?: unknown;
};

export function fakeCreationCore(options: FakeCreationCoreOptions = {}) {
  const calls: string[] = [];
  const generationRequests: Record<string, unknown>[] = [];
  const instructionRequests: Record<string, unknown>[] = [];
  const runInputs: Record<string, unknown>[] = [];
  let applied = false;
  let polls = 0;
  const generation = options.generation ?? { kind: "proposed" };
  const proposalVisible = () => generation.kind === "proposed" || (generation.kind === "timeout" && generation.proposalAfterPolls !== undefined && polls >= generation.proposalAfterPolls);
  const attempts = options.attempts ?? [{ nodeId: "node.open", status: "succeeded" }, { nodeId: "node.extract", status: "succeeded" }];
  const datasets = options.datasets ?? [{ datasetId: "dataset.one", nodeIds: ["node.extract"], rows: PAGE_ONE_RECORDS }];
  const adaptation = (status: string, extra: Partial<ExistingFlowAdaptation> = {}): ExistingFlowAdaptation => ({
    adaptationId: ADAPTATION_ID,
    projectId: PROJECT_ID,
    flowId: FLOW_ID,
    status,
    adaptationKind: "flow_bootstrap",
    accounting: { provider: "deepseek", model: DEFAULT_LLM_MODEL, inputTokens: 12_000, outputTokens: 2_000, totalTokens: 14_000, estimatedCostUsd: 0.01 },
    ...(options.evidenceLoop === null ? {} : { evidenceLoop: options.evidenceLoop ?? { providerCallCount: 4, decisionCount: 4, traceStepCount: 5, iterationCount: 5, toolCallCount: 4, evidenceBytes: 18_000, toolIds: ["web.recovery.inspect", "WEB.Unrecognized.Tool"] } }),
    ...(options.consequences === undefined ? {} : { consequences: options.consequences }),
    ...extra,
  });

  const control: CreatedFlowLaneControl = {
    async automationStudioCall(endpoint, payload) {
      calls.push(endpoint);
      if (endpoint === "create-flow") return { flow: { flowId: FLOW_ID, projectId: payload.projectId, name: payload.name } };
      if (endpoint === "get-flow") {
        if (payload.flowId === GRAPH_FLOW_ID) return { flow: { flowId: GRAPH_FLOW_ID, nodes: options.graphNodes ?? EXTRACTING_NODES, edges: options.graphEdges ?? EXTRACTING_EDGES } };
        return { flow: options.blankFlow ?? { flowId: FLOW_ID, projectId: PROJECT_ID, nodes: [], edges: [], metadata: { flowRepresentationKind: "orchestration" } } };
      }
      if (endpoint === "list-flow-subflows") return { subflows: applied ? [{ subflowId: "subflow.one", graphFlowId: GRAPH_FLOW_ID }] : [] };
      if (endpoint === "get-flow-router") return { router: applied ? { routerId: "router.one" } : null };
      if (endpoint === "list-conversations") return { conversations: [{ conversationId: "conversation.flow", pendingAskCount: 0, subject: { kind: "flow", id: FLOW_ID } }] };
      if (endpoint === "get-conversation") return { conversation: { turns: (options.flowThreadAsks ?? []).map((ask, index) => ({ turnId: `turn.${index}`, ask })), hasMore: false } };
      if (endpoint === "get-flow-adaptation") return { adaptation: { adaptationId: ADAPTATION_ID, metadata: { phase9: { auditEvents: [{ eventType: "created", detail: options.buildJudged === undefined ? {} : { buildJudged: options.buildJudged } }] } } } };
      if (endpoint === "save-flow-generation-instruction") {
        instructionRequests.push(payload);
        return { instruction: { instructionId: "instruction.one", status: options.instructionStatus ?? "active" } };
      }
      if (endpoint === "get-flow-run-detail") {
        const actionAttempts = attempts.map((attempt, index) => ({ attemptId: `attempt.${index}`, nodeId: attempt.nodeId, definitionId: "web.output", order: index, status: attempt.status, startedAt: 10 + index, finishedAt: 20 + index }));
        const summaries = datasets.map(({ datasetId, nodeIds, rows }) => ({ runId: "run.created", datasetId, nodeIds, recordCount: rows.length, truncated: false, invalidCount: 0 }));
        return { runDetail: { summary: { runId: "run.created", status: options.runStatus ?? "succeeded" }, actionAttempts, interventions: [], ...(summaries.length ? { datasets: summaries } : {}) } };
      }
      if (endpoint === "get-run-dataset-page") {
        const stored = datasets.find((dataset) => dataset.datasetId === payload.datasetId);
        if (!stored) throw new Error(`unknown dataset ${String(payload.datasetId)}`);
        const fields = [...new Set(stored.rows.flatMap((row) => Object.keys(row)))].map((id) => ({ id, label: id, valueType: "string" }));
        return { dataset: { summary: { runId: "run.created", datasetId: stored.datasetId, nodeIds: stored.nodeIds, recordCount: stored.rows.length, truncated: false, invalidCount: 0 }, schema: { schemaVersion: "0.1", fields }, rows: stored.rows, nextCursor: null } };
      }
      throw new Error(`unexpected endpoint ${endpoint}`);
    },
    async selectExistingContext() { calls.push("select-context"); },
    async generateFlowBootstrapAdaptation(input) {
      calls.push("generate");
      generationRequests.push(input);
      if (generation.kind === "timeout") throw new RunnerFailure("runtime.behavior", "FluxIQ HTTP operation timed out", { details: { bounded: "timeout", operationStage: "control.request", timeoutMs: 1 } });
      if (generation.kind === "transport") throw new RunnerFailure("runtime.behavior", "FluxIQ HTTP transport failed", { details: { transportCode: "ECONNRESET" } });
      if (generation.kind === "refused") return { status: generation.status, ok: false, payload: generation.payload };
      return { status: 200, ok: true, payload: { adaptation: { projectId: input.projectId, flowId: input.flowId, adaptationId: ADAPTATION_ID, status: "proposed", accounting: { requestId: "evidence.one" } } } };
    },
    async listFlowAdaptations() {
      calls.push("list-adaptations");
      polls += 1;
      return proposalVisible() ? [{ adaptationId: ADAPTATION_ID, projectId: PROJECT_ID, flowId: FLOW_ID, status: "proposed" }] : [];
    },
    async getFlowAdaptation() {
      calls.push("get-adaptation");
      return adaptation(options.adaptationStatus ?? "proposed");
    },
    async approveFlowAdaptation() {
      calls.push("approve");
      return adaptation("validated");
    },
    async applyFlowAdaptation() {
      calls.push("apply");
      applied = true;
      return adaptation("applied", { appliedMutationCount: options.appliedMutationCount ?? 2 });
    },
    async startPersistedFlow(input) {
      calls.push("start");
      runInputs.push(input.inputs ?? {});
      return { runId: "run.created" };
    },
    async runPersistedFlow() {
      calls.push("run");
      return { session: { runId: "run.created", status: options.runStatus ?? "succeeded" } };
    },
    async getRunDetail() {
      throw new Error("a run that recorded no recovery was read for one");
    },
  };
  return { control, calls, generationRequests, instructionRequests, runInputs };
}
