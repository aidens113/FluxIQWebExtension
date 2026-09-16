import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LLM_LAB_BUDGET, LLM_LAB_SCHEMA_VERSION, type LlmExecutionProfile } from "@fluxiq-web-extension/test-contracts";
import { issueLiveLlmExecutionGrant } from "../execution-grant.js";
import { planLiveLlmExecution, type LiveLlmPlan } from "../live-llm-plan.js";

/**
 * The grant request is where the Lab's plan becomes Core's authorization. These
 * pin what it sends -- the iterating call count, the run token budget, and
 * Core's high-token confirmation on exactly one side of the threshold -- and
 * that a grant authorizing more than was asked for is refused.
 */

function plan(task: LlmExecutionProfile["task"], budget: Partial<LlmExecutionProfile["budget"]> = {}): LiveLlmPlan {
  return planLiveLlmExecution({
    schemaVersion: LLM_LAB_SCHEMA_VERSION,
    profileId: `lab-${task}`,
    mode: "live",
    provider: "deepseek",
    model: "deepseek-chat",
    task,
    scenarioNetworkPolicy: "loopback-only",
    providerEgressPolicy: "core-trusted-provider-only",
    externalSideEffects: false,
    approvalMode: "manual",
    retainRawPrompts: false,
    retainRawResponses: false,
    maxConcurrentRuns: 1,
    budget: { ...DEFAULT_LLM_LAB_BUDGET, ...budget },
  });
}

type Call = { endpoint: string; payload: Record<string, unknown> };

/** A Core that records every request and issues exactly what the issue call asked for, unless told otherwise. */
function fakeCore(grantOverrides: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  return {
    calls,
    control: {
      async automationStudioCall(endpoint: string, payload: Record<string, unknown>): Promise<unknown> {
        calls.push({ endpoint, payload: structuredClone(payload) });
        if (endpoint === "preflight-llm-execution") return { preflight: {} };
        const tokenLimits = payload.tokenLimits as { maxTotalTokens: number };
        const maxCalls = payload.maxCalls as number;
        return {
          grant: {
            grantId: "llm-grant:test",
            purpose: payload.purpose,
            maxCalls,
            maxTotalTokensPerRun: payload.maxTotalTokensPerRun ?? Math.min(tokenLimits.maxTotalTokens * maxCalls, 100_000),
            maxEstimatedCostUsd: payload.maxEstimatedCostUsd,
            maxTotalEstimatedCostUsd: Math.min(2, (payload.maxEstimatedCostUsd as number) * maxCalls),
            timeoutMs: payload.timeoutMs,
            providerRetryCount: 0,
            ...grantOverrides,
          },
        };
      },
    },
  };
}

const target = { projectId: "project-1", flowId: "flow-1", secretKeyId: "key-1" };

test("an adapt grant asks Core for the operator's call count and the run token budget", async () => {
  const core = fakeCore();
  const grant = await issueLiveLlmExecutionGrant(core.control, { ...target, plan: plan("adapt", { maxCallsPerRun: 10 }) });
  assert.deepEqual(core.calls.map(call => call.endpoint), ["preflight-llm-execution", "issue-llm-execution-grant"]);
  const [preflight, issue] = core.calls;
  assert.equal(preflight?.payload.purpose, "diagnose_and_adapt");
  assert.equal(preflight?.payload.maxCalls, 10);
  assert.equal(preflight?.payload.maxTotalTokensPerRun, 100_000);
  assert.equal(preflight?.payload.maxTotalEstimatedCostUsd, 2);
  assert.equal(issue?.payload.maxCalls, 10);
  assert.equal(issue?.payload.maxUses, 10);
  assert.equal(issue?.payload.maxTotalTokensPerRun, 100_000);
  assert.equal(grant.maxCalls, 10);
  assert.equal(grant.maxTotalTokensPerRun, 100_000);
});

test("a run token budget at Core's threshold is issued without a high-token confirmation", async () => {
  // The default adapt run: 26 calls at 10,000 tokens, held to Core's default 100,000.
  for (const budget of [{}, { maxTotalTokensPerRun: 100_000 }]) {
    const core = fakeCore();
    const grant = await issueLiveLlmExecutionGrant(core.control, { ...target, plan: plan("adapt", budget) });
    const issue = core.calls.find(call => call.endpoint === "issue-llm-execution-grant");
    assert.equal(issue?.payload.maxCalls, 26);
    assert.equal(issue?.payload.maxTotalTokensPerRun, 100_000);
    assert.equal("highTokenConfirmation" in (issue?.payload ?? {}), false, JSON.stringify(budget));
    assert.equal(grant.highTokenConfirmationSent, false);
  }
});

test("a run token budget above Core's threshold is issued with the confirmation, on the issue call only", async () => {
  const core = fakeCore();
  const grant = await issueLiveLlmExecutionGrant(core.control, { ...target, plan: plan("adapt", { maxTotalTokensPerRun: 100_001 }) });
  const [preflight, issue] = core.calls;
  assert.equal("highTokenConfirmation" in (preflight?.payload ?? {}), false);
  assert.equal(issue?.payload.highTokenConfirmation, true);
  assert.equal(issue?.payload.maxTotalTokensPerRun, 100_001);
  assert.equal(grant.highTokenConfirmationSent, true);
});

test("a diagnosis grant asks for exactly one call whatever cap was typed", async () => {
  const core = fakeCore();
  const grant = await issueLiveLlmExecutionGrant(core.control, { ...target, plan: plan("diagnose", { maxCallsPerRun: 26 }) });
  const issue = core.calls.find(call => call.endpoint === "issue-llm-execution-grant");
  assert.equal(issue?.payload.purpose, "diagnosis_only");
  assert.equal(issue?.payload.maxCalls, 1);
  assert.equal(issue?.payload.maxUses, 1);
  assert.equal(issue?.payload.maxTotalTokensPerRun, 10_000);
  assert.equal(grant.maxCalls, 1);
});

test("a grant authorizing more than this run asked for is refused", async () => {
  const adapt = plan("adapt", { maxCallsPerRun: 10, maxEstimatedCostUsd: 0.05 });
  const cases: Array<[Record<string, unknown>, RegExp]> = [
    [{ maxCalls: 11 }, /more calls than this run asked for/u],
    [{ maxTotalTokensPerRun: 100_001 }, /larger run token budget than this run asked for/u],
    [{ maxTotalEstimatedCostUsd: 0.51 }, /more total cost than this run asked for/u],
    [{ maxEstimatedCostUsd: 0.06 }, /more cost per call than this run asked for/u],
    [{ purpose: "explore_and_adapt" }, /grant for a different purpose/u],
    [{ maxTotalTokensPerRun: 0 }, /invalid grant run token budget/u],
  ];
  for (const [override, expected] of cases) {
    await assert.rejects(issueLiveLlmExecutionGrant(fakeCore(override).control, { ...target, plan: adapt }), expected, JSON.stringify(override));
  }
});

test("a grant from a Core that reports no run token budget is accepted and recorded as unreported", async () => {
  const grant = await issueLiveLlmExecutionGrant(fakeCore({ maxTotalTokensPerRun: undefined }).control, { ...target, plan: plan("adapt") });
  assert.equal(grant.maxTotalTokensPerRun, null);
  assert.equal(grant.maxCalls, 26);
});
