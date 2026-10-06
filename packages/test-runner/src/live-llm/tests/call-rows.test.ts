import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DEFAULT_LLM_LAB_BUDGET, DEFAULT_LLM_MODEL, LLM_LAB_SCHEMA_VERSION, type LlmExecutionProfile } from "@fluxiq-web-extension/test-contracts";
import type { CreatedFlowBuild } from "../../flow-lane/index.js";
import { planAtLabCeiling } from "./lab-ceiling.js";
import { LiveLlmRun } from "../live-llm-run.js";

// `run-musp8nz1-dbd3905a` and `run-musq0b1m-0472cfa0`: `observed.observedCalls`
// held the build's decision rows only, every `requestId`, `taskKind` and
// `promptVersion` null, while the chat, the instruction reading and the judges
// had no row at all -- and every one of those calls' `meta.json` in `steps/`
// named its request id and task kind. The snapshot's rows are the step log's.

const profile: LlmExecutionProfile = {
  schemaVersion: LLM_LAB_SCHEMA_VERSION, profileId: "lab-create", mode: "live", provider: "deepseek", model: DEFAULT_LLM_MODEL, task: "create-flow",
  scenarioNetworkPolicy: "loopback-only", providerEgressPolicy: "core-trusted-provider-only", externalSideEffects: false, approvalMode: "manual",
  retainRawPrompts: false, retainRawResponses: false, maxConcurrentRuns: 1, budget: { ...DEFAULT_LLM_LAB_BUDGET },
};

function fakeCore() {
  let metadata: unknown;
  return {
    async reauthenticate(): Promise<void> {},
    async secretKeysCall(endpoint: string, payload: Record<string, unknown>): Promise<unknown> {
      return endpoint === "snapshot" ? { keys: [] } : { id: "key-1", name: payload.name, kind: "llm", provider: "DeepSeek", scope: "global", enabled: true };
    },
    async automationStudioCall(endpoint: string, payload: Record<string, unknown>): Promise<unknown> {
      if (endpoint === "update-flow-settings") { metadata = (payload.flow as { metadata: unknown }).metadata; return {}; }
      if (endpoint === "get-flow") return { flow: { metadata } };
      throw new Error(`unexpected endpoint ${endpoint}`);
    },
  };
}

/** Two of the build's decisions, itemized by Core without identity, as the pro run's rows were. */
const build: CreatedFlowBuild = {
  outcome: "proposed", adaptationId: "adaptation-1", providerCalls: 3, providerInvocation: "attempted", loopProviderCalls: 2,
  accounting: { provider: "deepseek", model: DEFAULT_LLM_MODEL, inputTokens: 28_678, outputTokens: 181, totalTokens: 28_859, estimatedCostUsd: 0.019 },
  evidenceLoop: {
    decisionCount: 2, toolCallCount: 1, evidenceBytes: 1_000, toolIds: ["web.find_on_page"],
    steps: [
      { toolId: "web.find_on_page", iteration: 1, usage: { inputTokens: 13_787, outputTokens: 48, estimatedCostUsd: 0.00919446 } },
      { toolId: "core.decision_complete", iteration: 2, usage: { inputTokens: 14_891, outputTokens: 133, estimatedCostUsd: 0.009356424 } },
    ],
  } as unknown as CreatedFlowBuild["evidenceLoop"],
  instructedConsequences: [], declaredConsequences: null, consequenceCrossCheck: null, permissionRequest: null, failure: null, recoveredAfterTimeout: false, durationMs: 1_000,
};

type Meta = { kind: string; requestId: string | null; taskKind: string; phase: string; part: string | null; inputTokens: number; outputTokens: number; costUsd: number };
const metas: Meta[] = [
  { kind: "chat", requestId: null, taskKind: "panel_command", phase: "chat", part: null, inputTokens: 1_584, outputTokens: 78, costUsd: 0.00119988 },
  { kind: "decide", requestId: "llm.evidence_tool_decision.851c", taskKind: "evidence_tool_decision", phase: "explore", part: "creation", inputTokens: 13_787, outputTokens: 48, costUsd: 0.00919446 },
  { kind: "decide", requestId: "llm.evidence_tool_decision.9a10", taskKind: "evidence_tool_decision", phase: "explore", part: "creation", inputTokens: 14_891, outputTokens: 133, costUsd: 0.009356424 },
  { kind: "judge", requestId: "llm.flow_bootstrap_judge.77d2", taskKind: "flow_bootstrap_judge", phase: "judge", part: "creation", inputTokens: 3_000, outputTokens: 200, costUsd: 0.0021 },
];

test("live-llm.json lists every call the step log holds, each with its request id and task kind, the chat's and the judge's included", async (t) => {
  const steps = await mkdtemp(path.join(os.tmpdir(), "fluxiq-step-log-calls-"));
  t.after(() => rm(steps, { recursive: true, force: true }));
  for (const [index, meta] of metas.entries()) {
    const folder = path.join(steps, `${String(index * 2 + 1).padStart(4, "0")}-${meta.kind}`);
    await mkdir(folder);
    await writeFile(path.join(folder, "meta.json"), JSON.stringify({ step: index * 2 + 1, kind: meta.kind, provider: "deepseek", model: DEFAULT_LLM_MODEL, requestId: meta.requestId, taskKind: meta.taskKind, stage: null, part: meta.part, phase: meta.phase, usage: { inputTokens: meta.inputTokens, outputTokens: meta.outputTokens }, costUsd: meta.costUsd }));
    // A tool step between them names no provider, and one still being written has no meta yet: neither is a call.
    await mkdir(path.join(steps, `${String(index * 2 + 2).padStart(4, "0")}-tool-core.run_node`));
  }
  const run = new LiveLlmRun(planAtLabCeiling(profile), { name: "DEEPSEEK_API_KEY", source: "test", value: "test-provider-credential-value" });
  await run.buildAuthorizer(fakeCore(), { projectId: "project-1", authorizationPassword: "account-password" })("flow-1");
  run.readStepLogFrom(steps);
  const written: Array<{ path: string; value: unknown }> = [];
  await run.settleBuild(build, { writeStructured: async (bundlePath, value) => { written.push({ path: bundlePath, value }); } }, async () => undefined);
  const snapshot = written.filter(entry => entry.path === "snapshots/live-llm.json").at(-1)?.value as Record<string, any>;
  const rows = snapshot.observed.observedCalls as Array<Record<string, unknown>>;
  assert.equal(rows.length, 4, "one row per call in the step log, none twice");
  assert.deepEqual(rows.map(row => [row.requestId, row.taskKind, row.provider, row.model, row.inputTokens, row.outputTokens, row.totalTokens, row.estimatedCostUsd]), metas.map(meta => [meta.requestId, meta.taskKind, "deepseek", DEFAULT_LLM_MODEL, meta.inputTokens, meta.outputTokens, meta.inputTokens + meta.outputTokens, meta.costUsd]));
  assert.equal(snapshot.observed.perCallRecords, "recorded");
  assert.equal(snapshot.observed.unrecordedCalls, 0);
  assert.equal(snapshot.observed.calls, 4);
  // The build's own record is the build's, untouched.
  assert.equal(snapshot.build.evidenceLoop.steps.length, 2);
});
