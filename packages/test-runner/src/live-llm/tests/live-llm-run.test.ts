import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LLM_LAB_BUDGET, LLM_LAB_SCHEMA_VERSION, type LlmExecutionProfile } from "@fluxiq-web-extension/test-contracts";
import type { ExistingRunDetail } from "../../existing-fluxiq-control.js";
import { planLiveLlmExecution } from "../live-llm-plan.js";
import { LiveLlmRun } from "../live-llm-run.js";

/**
 * A run that confirms Core's high-token exposure on the operator's behalf must
 * say so where the run's evidence is kept, with the reason, and a run that did
 * not must say that too. These drive one run end to end against a fake Core:
 * authorize, settle, and read back `snapshots/live-llm.json`.
 */

const CREDENTIAL = { name: "DEEPSEEK_API_KEY", source: "test", value: "test-provider-credential-value" };

function profile(budget: Partial<LlmExecutionProfile["budget"]>): LlmExecutionProfile {
  return {
    schemaVersion: LLM_LAB_SCHEMA_VERSION,
    profileId: "lab-adapt",
    mode: "live",
    provider: "deepseek",
    model: "deepseek-chat",
    task: "adapt",
    scenarioNetworkPolicy: "loopback-only",
    providerEgressPolicy: "core-trusted-provider-only",
    externalSideEffects: false,
    approvalMode: "manual",
    retainRawPrompts: false,
    retainRawResponses: false,
    maxConcurrentRuns: 1,
    budget: { ...DEFAULT_LLM_LAB_BUDGET, ...budget },
  };
}

function fakeCore() {
  const issueRequests: Record<string, unknown>[] = [];
  let metadata: unknown;
  return {
    issueRequests,
    control: {
      async reauthenticate(): Promise<void> {},
      async secretKeysCall(endpoint: string, payload: Record<string, unknown>): Promise<unknown> {
        if (endpoint === "snapshot") return { keys: [] };
        return { id: "key-1", name: payload.name, kind: "llm", provider: "DeepSeek", scope: "global", enabled: true };
      },
      async automationStudioCall(endpoint: string, payload: Record<string, unknown>): Promise<unknown> {
        if (endpoint === "update-flow-settings") {
          metadata = (payload.flow as { metadata: unknown }).metadata;
          return {};
        }
        if (endpoint === "get-flow") return { flow: { metadata } };
        if (endpoint === "preflight-llm-execution") return { preflight: {} };
        issueRequests.push(payload);
        const maxCalls = payload.maxCalls as number;
        return {
          grant: {
            grantId: "llm-grant:test",
            purpose: payload.purpose,
            maxCalls,
            maxTotalTokensPerRun: payload.maxTotalTokensPerRun,
            maxEstimatedCostUsd: payload.maxEstimatedCostUsd,
            maxTotalEstimatedCostUsd: Math.min(2, (payload.maxEstimatedCostUsd as number) * maxCalls),
            timeoutMs: payload.timeoutMs,
            providerRetryCount: 0,
          },
        };
      },
    },
  };
}

/** Three real-looking calls: more than the Lab used to allow, well inside every cap. */
const detail: ExistingRunDetail = {
  summary: { runId: "run-1", projectId: "project-1", flowId: "flow-1", status: "failed", routeDecisionCount: 0, subflowEntryCount: 0, actionAttemptCount: 1, updatedAt: 1 },
  routeDecisions: [],
  subflows: [],
  actionAttempts: [],
  interventions: [
    { interventionId: "i-1", kind: "diagnosis", provider: "deepseek", model: "deepseek-chat", validationOk: true, inputTokens: 900, outputTokens: 100, totalTokens: 1_000, estimatedCostUsd: 0.001 },
    { interventionId: "i-2", kind: "diagnosis", provider: "deepseek", model: "deepseek-chat", validationOk: true, inputTokens: 900, outputTokens: 100, totalTokens: 1_000, estimatedCostUsd: 0.001 },
    { interventionId: "i-3", kind: "runtime_patch", provider: "deepseek", model: "deepseek-chat", validationOk: true, inputTokens: 900, outputTokens: 100, totalTokens: 1_000, estimatedCostUsd: 0.001 },
  ],
  llmAccounting: { calls: 3, inputTokens: 2_700, outputTokens: 300, totalTokens: 3_000, estimatedCostUsd: 0.003, budgetBreaches: 0, pendingCalls: 0 },
  llmGate: { invoked: true },
};

async function runOnce(budget: Partial<LlmExecutionProfile["budget"]>) {
  const core = fakeCore();
  const run = new LiveLlmRun(planLiveLlmExecution(profile(budget)), CREDENTIAL);
  const execution = await run.authorizer(core.control, { projectId: "project-1", authorizationPassword: "account-password" })("flow-1");
  const written: Array<{ path: string; value: unknown }> = [];
  await run.settle(
    { getRunDetail: async () => detail },
    { projectId: "project-1", runId: "run-1" },
    { writeStructured: async (bundlePath, value) => { written.push({ path: bundlePath, value }); } },
    async () => undefined,
  );
  const snapshot = written.find(entry => entry.path === "snapshots/live-llm.json")?.value as Record<string, any> | undefined;
  assert.ok(snapshot, "the run wrote no live-LLM snapshot");
  assert.equal(JSON.stringify(snapshot).includes(CREDENTIAL.value), false, "the snapshot carries the credential");
  return { core, run, execution, snapshot };
}

test("a default adapt run records that it sent no high-token confirmation, and why", async () => {
  const { core, run, execution, snapshot } = await runOnce({});
  assert.deepEqual(execution, { grantId: "llm-grant:test", purpose: "diagnose_and_adapt" });
  assert.equal("highTokenConfirmation" in (core.issueRequests[0] ?? {}), false);
  assert.equal(snapshot.authorized.maxCalls, 26);
  assert.equal(snapshot.authorized.maxTotalTokensPerRun, 100_000);
  assert.equal(snapshot.granted.maxTotalTokensPerRun, 100_000);
  assert.equal(snapshot.highTokenConfirmation.sent, false);
  assert.equal(snapshot.highTokenConfirmation.authorizedTokens, 100_000);
  assert.equal(snapshot.highTokenConfirmation.threshold, 100_000);
  assert.match(snapshot.highTokenConfirmation.reason, /within Core's 100000-token confirmation threshold; no confirmation is needed/u);
  assert.equal(run.usage.calls, 3);
});

test("a run whose typed token budget is above the threshold records that it sent the confirmation, and why", async () => {
  const { core, snapshot } = await runOnce({ maxTotalTokensPerRun: 150_000 });
  assert.equal(core.issueRequests[0]?.highTokenConfirmation, true);
  assert.equal(snapshot.highTokenConfirmation.sent, true);
  assert.equal(snapshot.highTokenConfirmation.authorizedTokens, 150_000);
  assert.match(snapshot.highTokenConfirmation.reason, /--llm-max-run-tokens 150000\) is above Core's 100000-token confirmation threshold; the explicit --live-llm budget is the operator's confirmation/u);
  assert.equal(snapshot.declared.maxTotalTokensPerRun, 150_000);
});
