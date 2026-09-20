import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DEFAULT_LLM_LAB_BUDGET, LLM_LAB_SCHEMA_VERSION, type LlmExecutionProfile } from "@fluxiq-web-extension/test-contracts";
import { AUTOMATION_STUDIO_LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD } from "fluxiq/automation-studio";
import type { ExistingRunDetail } from "../../existing-fluxiq-control.js";
import { RunnerFailure } from "../../failure.js";
import type { CreatedFlowBuild } from "../../flow-lane/index.js";
import { planLiveLlmExecution } from "../live-llm-plan.js";
import { beginLiveLlmRun, LiveLlmRun } from "../live-llm-run.js";

/**
 * A run that confirms Core's high-token exposure on the operator's behalf must
 * say so where the run's evidence is kept, with the reason, and a run that did
 * not must say that too. These drive one run end to end against a fake Core:
 * authorize, settle, and read back `snapshots/live-llm.json`.
 */

/** Core's own threshold and the shared per-request budget, imported rather than copied. */
const CORE_THRESHOLD = AUTOMATION_STUDIO_LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD;
const PER_REQUEST = DEFAULT_LLM_LAB_BUDGET.maxTotalTokensPerRequest;

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
    // No recovery trace on this run detail: the snapshot must then say the
    // exploration record is absent rather than inventing an empty one.
    { getRunDetail: async () => detail, automationStudioCall: async () => ({ runDetail: { metadata: {} } }) },
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
  assert.equal(snapshot.authorized.maxTotalTokensPerRun, CORE_THRESHOLD);
  assert.equal(snapshot.granted.maxTotalTokensPerRun, CORE_THRESHOLD);
  assert.equal(snapshot.highTokenConfirmation.sent, false);
  assert.equal(snapshot.highTokenConfirmation.authorizedTokens, CORE_THRESHOLD);
  assert.equal(snapshot.highTokenConfirmation.threshold, CORE_THRESHOLD);
  assert.match(snapshot.highTokenConfirmation.reason, new RegExp(`within Core's ${CORE_THRESHOLD}-token confirmation threshold; no confirmation is needed`, "u"));
  assert.equal(snapshot.exploration.source, "absent");
  assert.equal(snapshot.exploration.counts.actions, null, "an unexplored run must not read as an exploration that did nothing");
  assert.equal(run.usage.calls, 3);
});

test("a run whose typed token budget is above the threshold records that it sent the confirmation, and why", async () => {
  // One full request past Core's threshold, so the confirmation is required.
  const aboveThreshold = CORE_THRESHOLD + PER_REQUEST;
  const { core, snapshot } = await runOnce({ maxTotalTokensPerRun: aboveThreshold });
  assert.equal(core.issueRequests[0]?.highTokenConfirmation, true);
  assert.equal(snapshot.highTokenConfirmation.sent, true);
  assert.equal(snapshot.highTokenConfirmation.authorizedTokens, aboveThreshold);
  assert.match(snapshot.highTokenConfirmation.reason, new RegExp(`--llm-max-run-tokens ${aboveThreshold}\\) is above Core's ${CORE_THRESHOLD}-token confirmation threshold; the explicit --live-llm budget is the operator's confirmation`, "u"));
  assert.equal(snapshot.declared.maxTotalTokensPerRun, aboveThreshold);
});

async function noKeyRepository(t: test.TestContext): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-live-run-no-key-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("a live run refuses before a credential is read when its lane or target does not fit the task", async (t) => {
  const repositoryRoot = await noKeyRepository(t);
  const begin = (task: LlmExecutionProfile["task"], flowLane: boolean, targetMode: string) => beginLiveLlmRun({ profile: { ...profile({}), task }, repositoryRoot, environment: {}, flowLane, targetMode });
  await assert.rejects(begin("create-flow", true, "isolated"), /--llm-task create-flow builds its Flow from an instruction task, not from the run's recording: drop --flow/u);
  await assert.rejects(begin("adapt", false, "isolated"), /A live LLM run needs the Flow lane: pass --flow/u);
  for (const targetMode of ["existing", "clone"]) {
    await assert.rejects(begin("create-flow", false, targetMode), new RegExp(`the ${targetMode} target's is not; use --target isolated or persistent-isolated`, "u"));
  }
  // Only once the lane and the target fit does the missing credential refuse.
  await assert.rejects(begin("create-flow", false, "isolated"), (error: unknown) => error instanceof RunnerFailure && error.category === "environment.missing" && /DEEPSEEK_API_KEY is not set/u.test(error.message));
});

test("a create-flow run fits only a scenario run that carries an instruction task and no recorded Flow lane", () => {
  const create = new LiveLlmRun(planLiveLlmExecution({ ...profile({}), task: "create-flow" }), CREDENTIAL);
  assert.equal(create.createsFlow, true);
  create.assertLane({ flowLane: false, creation: true });
  assert.throws(() => create.assertLane({ flowLane: false, creation: false }), /needs an instruction task to build from/u);
  assert.throws(() => create.assertLane({ flowLane: true, creation: true }), /drop --flow/u);
  const adapt = new LiveLlmRun(planLiveLlmExecution(profile({})), CREDENTIAL);
  assert.equal(adapt.createsFlow, false);
  adapt.assertLane({ flowLane: true, creation: false });
  assert.throws(() => adapt.assertLane({ flowLane: true, creation: true }), /An instruction task is built only by --llm-task create-flow, not adapt/u);
  // A dry run's description names where the key was found, never the key.
  const described = create.describe();
  assert.equal(described.purpose, "build_and_adapt");
  assert.deepEqual(described.credentialSource, { name: "DEEPSEEK_API_KEY", from: "test" });
  assert.equal(JSON.stringify(described).includes(CREDENTIAL.value), false);
});

test("a build grant authorizes only a build, and a run grant only a run", async () => {
  const create = new LiveLlmRun(planLiveLlmExecution({ ...profile({}), task: "create-flow" }), CREDENTIAL);
  await assert.rejects(create.authorizer(fakeCore().control, { projectId: "project-1", authorizationPassword: "account-password" })("flow-1"), /A build_and_adapt grant authorizes a Flow build, never a Flow run/u);
  const adapt = new LiveLlmRun(planLiveLlmExecution(profile({})), CREDENTIAL);
  await assert.rejects(adapt.buildAuthorizer(fakeCore().control, { projectId: "project-1", authorizationPassword: "account-password" })("flow-1"), /A diagnose_and_adapt grant cannot authorize a Flow build/u);
});

const proposedBuild: CreatedFlowBuild = {
  outcome: "proposed",
  adaptationId: "adaptation-1",
  providerCalls: 5,
  providerInvocation: "attempted",
  accounting: { provider: "deepseek", model: "deepseek-chat", inputTokens: 20_000, outputTokens: 3_000, totalTokens: 23_000, estimatedCostUsd: 0.02 },
  evidenceLoop: { decisionCount: 5, toolCallCount: 4, evidenceBytes: 9_000, toolIds: ["web.recovery.inspect"], steps: null },
  instructedConsequences: [],
  permissionRequest: null,
  failure: null,
  recoveredAfterTimeout: false,
  durationMs: 40_000,
};

async function settleBuildOnce(build: CreatedFlowBuild) {
  const core = fakeCore();
  // The whole per-request triple is the shared budget's. Overriding only the
  // output and total limits left the input limit at the default, and input plus
  // output may not exceed the total, so every build below was refused unrun.
  const run = new LiveLlmRun(planLiveLlmExecution({ ...profile({}), task: "create-flow" }), CREDENTIAL);
  const grant = await run.buildAuthorizer(core.control, { projectId: "project-1", authorizationPassword: "account-password" })("flow-1");
  const written: Array<{ path: string; value: unknown }> = [];
  const published: Record<string, unknown>[] = [];
  const settle = () => run.settleBuild(build, { writeStructured: async (bundlePath, value) => { written.push({ path: bundlePath, value }); } }, async (details) => { published.push(details); });
  return { core, run, grant, written, published, settle };
}

test("a create-flow run authorizes a build_and_adapt grant and records the build it settled", async () => {
  const { core, run, grant, written, published, settle } = await settleBuildOnce(proposedBuild);
  await settle();
  assert.deepEqual(grant, { grantId: "llm-grant:test" });
  assert.equal(core.issueRequests[0]?.purpose, "build_and_adapt");
  assert.equal(core.issueRequests[0]?.maxCalls, 26);
  const snapshot = written.find(entry => entry.path === "snapshots/live-llm.json")?.value as Record<string, any>;
  assert.equal(snapshot.purpose, "build_and_adapt");
  assert.deepEqual(snapshot.build, proposedBuild);
  // Core counts a build's calls and reports its totals; it does not itemize them, and the record says so.
  assert.equal(snapshot.observed.calls, 5);
  assert.equal(snapshot.observed.perCallRecords, "not recorded");
  assert.deepEqual(snapshot.observed.observedCalls, []);
  assert.equal(snapshot.observed.accounting.totalTokens, 23_000);
  assert.equal(JSON.stringify(snapshot).includes(CREDENTIAL.value), false);
  assert.deepEqual(published, [{ calls: 5, interventions: 0, totalEstimatedCostUsd: 0.02, llmGate: { invoked: true } }]);
  assert.equal(run.usage.calls, 5);
});

test("a build that reached no provider fails the run closed, after its evidence is written, and says where Core stopped", async () => {
  const refused: CreatedFlowBuild = { ...proposedBuild, outcome: "failed", adaptationId: null, providerCalls: 0, providerInvocation: "not_attempted", accounting: null, evidenceLoop: null, failure: { code: "flow_bootstrap.provider_resolution_failed", stage: "provider_resolution", httpStatus: 400 } };
  const { written, settle } = await settleBuildOnce(refused);
  await assert.rejects(settle(), (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior"
    && /Live LLM run reached no provider: --live-llm authorized 26 deepseek call\(s\) for --llm-task create-flow and Core made none\. Core's Flow build stopped at provider_resolution before a provider answered\. \(flow_bootstrap\.provider_resolution_failed\)/u.test(error.message));
  assert.ok(written.some(entry => entry.path === "snapshots/live-llm.json"), "the refusal's evidence is written first");
  // A build that outlived its request with nothing to show counts as having called, so it fails on its own code, never as spend-free.
  const unfinished = await settleBuildOnce({ ...refused, providerCalls: null, providerInvocation: "unknown", failure: { code: "lab.generation_unfinished", stage: null, httpStatus: null } });
  await unfinished.settle();
  assert.equal(unfinished.run.usage.calls, 1);
});

test("a build over its run budget, over its call count, or run on another model fails the run", async () => {
  // One request past the run token budget, which for a default build is Core's threshold.
  const overspend = CORE_THRESHOLD + PER_REQUEST;
  const overspent = await settleBuildOnce({ ...proposedBuild, accounting: { ...proposedBuild.accounting!, totalTokens: overspend } });
  await assert.rejects(overspent.settle(), (error: unknown) => error instanceof RunnerFailure && error.category === "performance.budget" && new RegExp(`the run used ${overspend} total tokens against its run token budget of ${CORE_THRESHOLD}`, "u").test(error.message));
  const tooManyCalls = await settleBuildOnce({ ...proposedBuild, providerCalls: 27 });
  await assert.rejects(tooManyCalls.settle(), /the run made 27 provider call\(s\) against an authorized 26/u);
  const otherModel = await settleBuildOnce({ ...proposedBuild, accounting: { ...proposedBuild.accounting!, model: "deepseek-reasoner" } });
  await assert.rejects(otherModel.settle(), /Core's Flow build ran on deepseek\/deepseek-reasoner, not the authorized deepseek\/deepseek-chat/u);
});

// A created Flow's playback runs under its own grant, so a Flow that fails is
// repaired rather than refused for want of a model. The grant is proposal-only
// and bound by the same caps as the build; its spend is settled beside the
// build's, never folded into it.
test("a create-flow run repairs the Flow it built under a proposal-only diagnose_and_adapt grant, and settles that spend beside the build", async () => {
  const { core, run, written, published, settle } = await settleBuildOnce(proposedBuild);
  await settle();
  const execution = await run.repairAuthorizer(core.control, { projectId: "project-1", authorizationPassword: "account-password" })("flow-1");
  assert.deepEqual(execution, { grantId: "llm-grant:test", purpose: "diagnose_and_adapt" });
  const request = core.issueRequests[1];
  assert.equal(request?.purpose, "diagnose_and_adapt");
  for (const cap of ["maxCalls", "maxTotalTokensPerRun", "maxEstimatedCostUsd", "timeoutMs"]) assert.equal(request?.[cap], core.issueRequests[0]?.[cap], `the repair asks for no more ${cap} than the build`);

  await run.settleRepair({ getRunDetail: async () => detail, automationStudioCall: async () => ({ runDetail: { metadata: {} } }) }, { projectId: "project-1", runId: "run-1" }, { writeStructured: async (bundlePath, value) => { written.push({ path: bundlePath, value }); } }, async (details) => { published.push(details); });
  const snapshot = written.filter(entry => entry.path === "snapshots/live-llm.json").at(-1)?.value as Record<string, any>;
  assert.deepEqual(snapshot.build, proposedBuild, "the build stays as settled");
  assert.equal(snapshot.observed.accounting.totalTokens, 23_000, "and its totals are not folded into the repair's");
  assert.equal(snapshot.repair.purpose, "diagnose_and_adapt");
  assert.equal(snapshot.repair.runId, "run-1");
  assert.equal(snapshot.repair.observed.calls, 3);
  assert.equal(snapshot.repair.observed.observedCalls.length, 3);
  assert.deepEqual(published.at(-1), { repair: { calls: 3, interventions: 3, totalEstimatedCostUsd: 0.003, llmGate: { invoked: true } } });
  assert.equal(run.usage.calls, 5 + 3, "the evaluation counts every call the run paid for");
  assert.equal(JSON.stringify(snapshot).includes(CREDENTIAL.value), false);
});

test("only a create-flow run has a repair grant, and a repair that cannot be read back is recorded, not raised", async () => {
  const adapt = new LiveLlmRun(planLiveLlmExecution(profile({})), CREDENTIAL);
  await assert.rejects(adapt.repairAuthorizer(fakeCore().control, { projectId: "project-1", authorizationPassword: "account-password" })("flow-1"), /Only a create-flow run repairs the Flow it built/u);

  const { core, run, written, settle } = await settleBuildOnce(proposedBuild);
  await settle();
  await run.repairAuthorizer(core.control, { projectId: "project-1", authorizationPassword: "account-password" })("flow-1");
  const unreadable = { getRunDetail: async (): Promise<ExistingRunDetail> => { throw new Error("gone"); }, automationStudioCall: async () => ({ runDetail: { metadata: {} } }) };
  await run.settleRepair(unreadable, { projectId: "project-1", runId: "run-1" }, { writeStructured: async (bundlePath, value) => { written.push({ path: bundlePath, value }); } }, async () => undefined);
  const snapshot = written.filter(entry => entry.path === "snapshots/live-llm.json").at(-1)?.value as Record<string, any>;
  assert.deepEqual({ observed: snapshot.repair.observed, settlement: snapshot.repair.settlement }, { observed: null, settlement: "run_detail_unreadable" });
  assert.equal(run.usage.calls, 5);
});

test("a repair over its run budget fails the run, after its spend is written", async () => {
  const { core, run, written, settle } = await settleBuildOnce(proposedBuild);
  await settle();
  await run.repairAuthorizer(core.control, { projectId: "project-1", authorizationPassword: "account-password" })("flow-1");
  const overspent: ExistingRunDetail = { ...detail, llmAccounting: { ...detail.llmAccounting!, calls: 27 } };
  await assert.rejects(
    run.settleRepair({ getRunDetail: async () => overspent, automationStudioCall: async () => ({ runDetail: { metadata: {} } }) }, { projectId: "project-1", runId: "run-1" }, { writeStructured: async (bundlePath, value) => { written.push({ path: bundlePath, value }); } }, async () => undefined),
    (error: unknown) => error instanceof RunnerFailure,
  );
  const snapshot = written.filter(entry => entry.path === "snapshots/live-llm.json").at(-1)?.value as Record<string, any>;
  assert.equal(snapshot.repair.observed.calls, 27, "the overspend is on record before the run fails");
});
