import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LLM_PROVIDER, DEFAULT_LLM_LAB_BUDGET, DEFAULT_LLM_MODEL, LLM_LAB_SCHEMA_VERSION, type LlmExecutionProfile } from "@fluxiq-web-extension/test-contracts";
import type { ExistingRunDetail } from "../../existing-fluxiq-control.js";
import type { CreatedFlowBuild } from "../../flow-lane/index.js";
import { LiveLlmRun } from "../live-llm-run.js";
import { flowPurse } from "./flow-purse.js";
import { planAtLabCeiling } from "./lab-ceiling.js";

function record(value: unknown): Record<string, unknown> {
  assert.ok(value !== null && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}

// Core's purse files a paid result check under `judge` as it settles, apart from the playback's own recovery, so the
// Lab counts it once without matching request ids across records (which `run-spend.ts` did until t728).
test("real build and playback settlement count a canonical paid result check once in the snapshot and public usage", async () => {
  const profile: LlmExecutionProfile = {
    schemaVersion: LLM_LAB_SCHEMA_VERSION, profileId: "canonical-check", mode: "live", provider: DEFAULT_LLM_PROVIDER, model: DEFAULT_LLM_MODEL,
    task: "create-flow", scenarioNetworkPolicy: "loopback-only", providerEgressPolicy: "core-trusted-provider-only",
    externalSideEffects: false, approvalMode: "manual", retainRawPrompts: false, retainRawResponses: false, maxConcurrentRuns: 1,
    budget: { ...DEFAULT_LLM_LAB_BUDGET },
  };
  const run = new LiveLlmRun(planAtLabCeiling(profile), { name: "CLAUDE_API_KEY", source: "test", value: "unit-test-only" });
  let metadata: unknown;
  let purse = flowPurse({ build: [1, 0.001] });
  const spendReads: string[] = [];
  const owner = {
    async getFlowSpend(projectId: string, flowId: string) {
      spendReads.push(`${projectId}/${flowId}`);
      return purse;
    },
    async reauthenticate(): Promise<void> {},
    async secretKeysCall(endpoint: string, payload: Record<string, unknown>): Promise<unknown> {
      if (endpoint === "snapshot") return { keys: [] };
      assert.equal(endpoint, "create-key");
      return { id: "key-1", name: payload.name, kind: "llm", provider: payload.provider, metadata: payload.metadata, scope: "global", enabled: true };
    },
    async automationStudioCall(endpoint: string, payload: Record<string, unknown>): Promise<unknown> {
      if (endpoint === "update-flow-settings") {
        metadata = record(payload.flow).metadata;
        return {};
      }
      assert.equal(endpoint, "get-flow");
      return { flow: { metadata } };
    },
  };
  const build: CreatedFlowBuild = {
    outcome: "proposed", adaptationId: "adaptation-1", providerCalls: 1, providerInvocation: "attempted",
    accounting: { provider: DEFAULT_LLM_PROVIDER, model: DEFAULT_LLM_MODEL, inputTokens: 100, outputTokens: 10, totalTokens: 110, estimatedCostUsd: 0.001 },
    evidenceLoop: null, instructedConsequences: [], declaredConsequences: null, consequenceCrossCheck: null, permissionRequest: null,
    loopProviderCalls: 1, failure: null, recoveredAfterTimeout: false, durationMs: 1,
  };
  let snapshot: unknown;
  const bundle = { async writeStructured(file: string, value: unknown): Promise<void> { if (file === "snapshots/live-llm.json") snapshot = value; } };
  const published: Record<string, unknown>[] = [];
  await run.buildAuthorizer(owner, { projectId: "project-1", authorizationPassword: "test-only" })("flow-1");
  await run.settleBuild(build, bundle, async (value) => { published.push(value); });
  await run.repairAuthorizer(owner, { projectId: "project-1", authorizationPassword: "test-only" })("flow-1");
  purse = flowPurse({ build: [1, 0.001], judge: [1, 0.002] });
  const detail: ExistingRunDetail = {
    summary: { runId: "run-1", projectId: "project-1", flowId: "flow-1", status: "succeeded", routeDecisionCount: 0, subflowEntryCount: 0, actionAttemptCount: 1, updatedAt: 1 },
    actionAttempts: [], routeDecisions: [], subflows: [], providerCallCount: 1, providerCallsOmitted: 0,
    llmAccounting: { calls: 1, inputTokens: 100, outputTokens: 10, totalTokens: 110, estimatedCostUsd: 0.002, pendingCalls: 0, budgetBreaches: 0 },
    llmGate: { invoked: true },
    providerCalls: [{
      sequence: 1, requestId: "paid-check-1", taskKind: "result_verification", stage: "verify", allowance: "run",
      provider: DEFAULT_LLM_PROVIDER, model: DEFAULT_LLM_MODEL, promptVersion: null, validationOk: true, validationCodes: [], budgetBreach: false,
      inputTokens: 100, outputTokens: 10, totalTokens: 110, estimatedCostUsd: 0.002,
      charged: { inputTokens: 100, outputTokens: 10, totalTokens: 110, estimatedCostUsd: 0.002, tokens: "reported", cost: "reported" },
    }],
  };
  const endpoints: string[] = [];
  await run.settleRepair({
    getFlowSpend: owner.getFlowSpend,
    getRunDetail: async () => detail,
    automationStudioCall: async (endpoint: string) => {
      endpoints.push(endpoint);
      assert.equal(endpoint, "get-flow-run-detail");
      return { runDetail: {
        metadata: { resultVerification: { status: "confirmed", performed: true, verdict: "answers", basis: "model", code: "core.result.answers", verdicts: ["answers"], calls: 1 } },
        interventions: [{ interventionId: "check-1", kind: "diagnosis", tokenUsage: { inputTokens: 100, outputTokens: 10, totalTokens: 110, estimatedCostUsd: 0.002 }, validation: { ok: true, issues: [] }, metadata: { requestId: "paid-check-1", source: "verifyAutomationStudioRunResult", verificationCheck: 1 } }],
      } };
    },
  }, { projectId: "project-1", runId: "run-1" }, bundle, async (value) => { published.push(value); });
  assert.deepEqual(endpoints, ["get-flow-run-detail"]);
  assert.deepEqual(spendReads, ["project-1/flow-1", "project-1/flow-1"], "one read of the Flow's purse per settlement");
  const settled = record(snapshot);
  const spend = record(settled.runSpend);
  assert.equal(spend.calls, 2);
  assert.equal(spend.totalEstimatedCostUsd, 0.003);
  const phases = record(spend.phases);
  assert.equal(phases.runtime, null);
  assert.deepEqual(phases.judge, { calls: 1, estimatedCostUsd: 0.002 });
  assert.equal(record(settled.observed).calls, 2);
  assert.equal(record(settled.observed).totalEstimatedCostUsd, 0.003);
  assert.equal(record(record(settled.repair).observed).calls, 0);
  assert.equal(record(settled.verification).calls, 1);
  assert.equal(run.usage.calls, 2);
  assert.equal(record(published.at(-1)?.runTotal).calls, 2);
  assert.equal(record(published.at(-1)?.runTotal).totalEstimatedCostUsd, 0.003);
});
