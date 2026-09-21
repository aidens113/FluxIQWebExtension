import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LLM_LAB_BUDGET, LLM_LAB_SCHEMA_VERSION, type LlmExecutionProfile } from "@fluxiq-web-extension/test-contracts";
import { AUTOMATION_STUDIO_LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD } from "fluxiq/automation-studio";
import { issueLiveLlmExecutionGrant } from "../execution-grant.js";
import { planLiveLlmExecution, type LiveLlmPlan } from "../live-llm-plan.js";

/**
 * The grant request is where the Lab's plan becomes Core's authorization. These
 * pin what it sends -- the iterating call count, the run token budget, and
 * Core's high-token confirmation on exactly one side of the threshold -- and
 * that a grant authorizing more than was asked for is refused.
 */

/** Core's own numbers, imported rather than copied: a literal here overrode Core rather than mirroring it. */
const CORE_THRESHOLD = AUTOMATION_STUDIO_LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD;
const PER_REQUEST = DEFAULT_LLM_LAB_BUDGET.maxTotalTokensPerRequest;
const DEFAULT_CALLS = DEFAULT_LLM_LAB_BUDGET.maxCallsPerRun;

function plan(task: LlmExecutionProfile["task"], budget: Partial<LlmExecutionProfile["budget"]> = {}, permit?: LlmExecutionProfile["permittedConsequences"]): LiveLlmPlan {
  return planLiveLlmExecution({
    ...(permit === undefined ? {} : { permittedConsequences: permit }),
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

/**
 * A Core that records every request and issues exactly what the issue call
 * asked for, unless told otherwise. Its preflight and grant echo the permitted
 * consequences the request carried, as Core's do.
 */
function fakeCore(grantOverrides: Record<string, unknown> = {}, preflightOverrides: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  return {
    calls,
    control: {
      async automationStudioCall(endpoint: string, payload: Record<string, unknown>): Promise<unknown> {
        calls.push({ endpoint, payload: structuredClone(payload) });
        if (endpoint === "preflight-llm-execution") return { preflight: { permittedConsequences: payload.permittedConsequences, ...preflightOverrides } };
        const tokenLimits = payload.tokenLimits as { maxTotalTokens: number };
        const maxCalls = payload.maxCalls as number;
        return {
          grant: {
            grantId: "llm-grant:test",
            purpose: payload.purpose,
            maxCalls,
            maxTotalTokensPerRun: payload.maxTotalTokensPerRun ?? Math.min(tokenLimits.maxTotalTokens * maxCalls, CORE_THRESHOLD),
            maxEstimatedCostUsd: payload.maxEstimatedCostUsd,
            maxTotalEstimatedCostUsd: Math.min(2, (payload.maxEstimatedCostUsd as number) * maxCalls),
            timeoutMs: payload.timeoutMs,
            providerRetryCount: 0,
            permittedConsequences: payload.permittedConsequences,
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
  // Ten authorized calls at the per-request ceiling: what those calls could
  // use, which is what the grant asks for.
  const tenCalls = PER_REQUEST * 10;
  assert.equal(preflight?.payload.maxTotalTokensPerRun, tenCalls);
  assert.equal(preflight?.payload.maxTotalEstimatedCostUsd, 2);
  assert.equal(issue?.payload.maxCalls, 10);
  assert.equal(issue?.payload.maxUses, 10);
  // Only the wait for the run to start: the run holds the grant from there.
  assert.equal(issue?.payload.ttlMs, 60_000);
  assert.equal(preflight?.payload.ttlMs, undefined);
  assert.equal(issue?.payload.maxTotalTokensPerRun, tenCalls);
  assert.equal(grant.maxCalls, 10);
  assert.equal(grant.maxTotalTokensPerRun, tenCalls);
});

test("a run token budget at Core's threshold is issued without a high-token confirmation", async () => {
  // The default adapt run: 26 calls at the per-request ceiling could use far
  // more than Core's threshold, so the budget is held down to the threshold.
  for (const budget of [{}, { maxTotalTokensPerRun: CORE_THRESHOLD }]) {
    const core = fakeCore();
    const grant = await issueLiveLlmExecutionGrant(core.control, { ...target, plan: plan("adapt", budget) });
    const issue = core.calls.find(call => call.endpoint === "issue-llm-execution-grant");
    assert.equal(issue?.payload.maxCalls, DEFAULT_CALLS);
    assert.equal(issue?.payload.maxTotalTokensPerRun, CORE_THRESHOLD);
    assert.equal("highTokenConfirmation" in (issue?.payload ?? {}), false, JSON.stringify(budget));
    assert.equal(grant.highTokenConfirmationSent, false);
  }
});

test("a run token budget above Core's threshold is issued with the confirmation, on the issue call only", async () => {
  const core = fakeCore();
  const grant = await issueLiveLlmExecutionGrant(core.control, { ...target, plan: plan("adapt", { maxTotalTokensPerRun: CORE_THRESHOLD + 1 }) });
  const [preflight, issue] = core.calls;
  assert.equal("highTokenConfirmation" in (preflight?.payload ?? {}), false);
  assert.equal(issue?.payload.highTokenConfirmation, true);
  assert.equal(issue?.payload.maxTotalTokensPerRun, CORE_THRESHOLD + 1);
  assert.equal(grant.highTokenConfirmationSent, true);
});

test("a diagnosis grant asks for exactly one call whatever cap was typed", async () => {
  const core = fakeCore();
  const grant = await issueLiveLlmExecutionGrant(core.control, { ...target, plan: plan("diagnose", { maxCallsPerRun: 26 }) });
  const issue = core.calls.find(call => call.endpoint === "issue-llm-execution-grant");
  assert.equal(issue?.payload.purpose, "diagnosis_only");
  assert.equal(issue?.payload.maxCalls, 1);
  assert.equal(issue?.payload.maxUses, 1);
  // One authorized call is one request's worth, whatever Core's threshold is.
  assert.equal(issue?.payload.maxTotalTokensPerRun, PER_REQUEST);
  assert.equal(grant.maxCalls, 1);
});

test("a grant authorizing more than this run asked for is refused", async () => {
  const adapt = plan("adapt", { maxCallsPerRun: 10, maxEstimatedCostUsd: 0.05 });
  const cases: Array<[Record<string, unknown>, RegExp]> = [
    [{ maxCalls: 11 }, /more calls than this run asked for/u],
    [{ maxTotalTokensPerRun: PER_REQUEST * 10 + 1 }, /larger run token budget than this run asked for/u],
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

test("without --llm-permit both requests ask for no consequences, and the grant permits none", async () => {
  const core = fakeCore();
  const grant = await issueLiveLlmExecutionGrant(core.control, { ...target, plan: plan("create-flow") });
  for (const call of core.calls) assert.deepEqual(call.payload.permittedConsequences, [], call.endpoint);
  assert.deepEqual(grant.permittedConsequences, []);
});

test("--llm-permit reaches the preflight and the grant as exactly the classes asked for", async () => {
  const core = fakeCore();
  const grant = await issueLiveLlmExecutionGrant(core.control, { ...target, plan: plan("create-flow", {}, ["create_new", "send_or_publish"]) });
  // Core's order, which is the order Core reports the set back in.
  for (const call of core.calls) assert.deepEqual(call.payload.permittedConsequences, ["send_or_publish", "create_new"], call.endpoint);
  assert.deepEqual(grant.permittedConsequences, ["send_or_publish", "create_new"]);
});

test("a second grant permits nothing, whatever the run was permitted", async () => {
  const core = fakeCore();
  const grant = await issueLiveLlmExecutionGrant(core.control, { ...target, plan: plan("create-flow", {}, ["send_or_publish"]), override: { purpose: "verify_result", maxCalls: 1 } });
  for (const call of core.calls) assert.deepEqual(call.payload.permittedConsequences, [], call.endpoint);
  assert.deepEqual(grant.permittedConsequences, []);
});

test("a preflight or grant that permits other than what was asked is refused", async () => {
  const permitted = plan("create-flow", {}, ["send_or_publish"]);
  const cases: Array<[Record<string, unknown>, Record<string, unknown>, RegExp]> = [
    // A class nobody asked for, caught before anything is issued.
    [{}, { permittedConsequences: ["send_or_publish", "move_money"] }, /preflight permits move_money, which this run did not ask for/u],
    [{}, { permittedConsequences: [] }, /preflight does not permit send_or_publish, which this run asked for/u],
    [{}, { permittedConsequences: undefined }, /preflight did not report the permitted consequences this run asked for/u],
    [{}, { permittedConsequences: "send_or_publish" }, /preflight reported invalid permitted consequences/u],
    [{ permittedConsequences: ["send_or_publish", "delete"] }, {}, /grant permits delete, which this run did not ask for/u],
    [{ permittedConsequences: [] }, {}, /grant does not permit send_or_publish, which this run asked for/u],
    [{ permittedConsequences: undefined }, {}, /grant did not report the permitted consequences this run asked for/u],
  ];
  for (const [grantOverride, preflightOverride, expected] of cases) {
    const core = fakeCore(grantOverride, preflightOverride);
    await assert.rejects(issueLiveLlmExecutionGrant(core.control, { ...target, plan: permitted }), expected, JSON.stringify({ grantOverride, preflightOverride }));
    // A preflight refusal issues nothing.
    if (Object.keys(preflightOverride).length) assert.deepEqual(core.calls.map(call => call.endpoint), ["preflight-llm-execution"]);
  }
  // A grant that permits more than an unpermitted run asked for is refused too.
  await assert.rejects(issueLiveLlmExecutionGrant(fakeCore({ permittedConsequences: ["send_or_publish"] }).control, { ...target, plan: plan("create-flow") }), /grant permits send_or_publish, which this run did not ask for/u);
});

test("a Core that reports no permitted set is accepted when none was asked for", async () => {
  const grant = await issueLiveLlmExecutionGrant(fakeCore({ permittedConsequences: undefined }, { permittedConsequences: undefined }).control, { ...target, plan: plan("adapt") });
  assert.deepEqual(grant.permittedConsequences, []);
});
