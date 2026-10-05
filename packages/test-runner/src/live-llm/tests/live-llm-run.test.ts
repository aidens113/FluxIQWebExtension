import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DEFAULT_LLM_LAB_BUDGET, DEFAULT_LLM_MODEL, LLM_LAB_SCHEMA_VERSION, type LlmExecutionProfile } from "@fluxiq-web-extension/test-contracts";
import type { ExistingRunDetail } from "../../existing-fluxiq-control.js";
import { RunnerFailure } from "../../failure.js";
import { settledBuildOf, type CreatedFlowBuild } from "../../flow-lane/index.js";
import { LAB_CEILING_USD, planAtLabCeiling } from "./lab-ceiling.js";
import { planLiveLlmExecution } from "../live-llm-plan.js";
import { beginLiveLlmRun, LiveLlmRun } from "../live-llm-run.js";

/**
 * One live run end to end against a fake Core: ready the Flow, settle, and
 * read back `snapshots/live-llm.json`. The fake answers only the endpoints a
 * live run uses; any other request fails the test.
 */

const PER_REQUEST = DEFAULT_LLM_LAB_BUDGET.maxTotalTokensPerRequest;

const CREDENTIAL = { name: "DEEPSEEK_API_KEY", source: "test", value: "test-provider-credential-value" };

function profile(budget: Partial<LlmExecutionProfile["budget"]>): LlmExecutionProfile {
  return {
    schemaVersion: LLM_LAB_SCHEMA_VERSION,
    profileId: "lab-adapt",
    mode: "live",
    provider: "deepseek",
    model: DEFAULT_LLM_MODEL,
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
  const settingsRequests: Array<Record<string, any>> = [];
  let metadata: unknown;
  return {
    settingsRequests,
    control: {
      async reauthenticate(): Promise<void> {},
      async secretKeysCall(endpoint: string, payload: Record<string, unknown>): Promise<unknown> {
        if (endpoint === "snapshot") return { keys: [] };
        return { id: "key-1", name: payload.name, kind: "llm", provider: "DeepSeek", scope: "global", enabled: true };
      },
      async automationStudioCall(endpoint: string, payload: Record<string, unknown>): Promise<unknown> {
        if (endpoint === "update-flow-settings") {
          settingsRequests.push(payload);
          metadata = (payload.flow as { metadata: unknown }).metadata;
          return {};
        }
        if (endpoint === "get-flow") return { flow: { metadata } };
        throw new Error(`unexpected endpoint ${endpoint}`);
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
    { interventionId: "i-1", kind: "diagnosis", provider: "deepseek", model: DEFAULT_LLM_MODEL, validationOk: true, inputTokens: 900, outputTokens: 100, totalTokens: 1_000, estimatedCostUsd: 0.001 },
    { interventionId: "i-2", kind: "diagnosis", provider: "deepseek", model: DEFAULT_LLM_MODEL, validationOk: true, inputTokens: 900, outputTokens: 100, totalTokens: 1_000, estimatedCostUsd: 0.001 },
    { interventionId: "i-3", kind: "runtime_patch", provider: "deepseek", model: DEFAULT_LLM_MODEL, validationOk: true, inputTokens: 900, outputTokens: 100, totalTokens: 1_000, estimatedCostUsd: 0.001 },
  ],
  llmAccounting: { calls: 3, inputTokens: 2_700, outputTokens: 300, totalTokens: 3_000, estimatedCostUsd: 0.003, budgetBreaches: 0, pendingCalls: 0 },
  llmGate: { invoked: true },
};

async function runOnce(budget: Partial<LlmExecutionProfile["budget"]>) {
  const core = fakeCore();
  const run = new LiveLlmRun(planAtLabCeiling(profile(budget)), CREDENTIAL);
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

test("an adapt run readies its Flow with its spend ceiling, carries its intent and permitted consequences, and records what it spent", async () => {
  const { core, run, execution, snapshot } = await runOnce({});
  assert.deepEqual(execution, { intent: "diagnose_and_adapt", permittedConsequences: [] });
  // The run's spend ceiling is a Flow setting now, saved with the rest.
  const saved = core.settingsRequests[0]?.flow.metadata;
  assert.deepEqual(saved.adaptationPolicySettings, { maxEstimatedCostUsdPerRun: LAB_CEILING_USD });
  assert.equal(saved.llmModel, DEFAULT_LLM_MODEL);
  assert.equal(snapshot.authorized.maxCalls, 26);
  assert.equal(snapshot.authorized.maxTotalTokensPerRun, PER_REQUEST * 26);
  assert.equal(snapshot.authorized.maxTotalEstimatedCostUsd, LAB_CEILING_USD);
  assert.deepEqual(snapshot.permittedConsequences, []);
  assert.equal(snapshot.exploration.source, "absent");
  assert.equal(snapshot.exploration.counts.actions, null, "an unexplored run must not read as an exploration that did nothing");
  assert.deepEqual(snapshot.verification, { source: "absent", status: null, basis: null, code: null, verdicts: [], recordedCalls: null, calls: 0, interventions: [], totalEstimatedCostUsd: 0 });
  assert.equal(run.usage.calls, 3);
});

test("a run's --llm-permit travels with its intent and is recorded, and a typed token budget is kept", async () => {
  const core = fakeCore();
  const run = new LiveLlmRun(planAtLabCeiling({ ...profile({ maxTotalTokensPerRun: PER_REQUEST * 3 }), task: "repair", permittedConsequences: ["create_new", "send_or_publish"] }), CREDENTIAL);
  const execution = await run.authorizer(core.control, { projectId: "project-1", authorizationPassword: "account-password" })("flow-1");
  assert.deepEqual(execution, { intent: "explore_and_adapt", permittedConsequences: ["send_or_publish", "create_new"] });
  assert.deepEqual(run.describe().permittedConsequences, ["send_or_publish", "create_new"]);
  assert.equal(run.describe().authorized.maxTotalTokensPerRun, PER_REQUEST * 3);
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
  const create = new LiveLlmRun(planAtLabCeiling({ ...profile({}), task: "create-flow" }), CREDENTIAL);
  assert.equal(create.createsFlow, true);
  create.assertLane({ flowLane: false, creation: true });
  assert.throws(() => create.assertLane({ flowLane: false, creation: false }), /needs an instruction task to build from/u);
  assert.throws(() => create.assertLane({ flowLane: true, creation: true }), /drop --flow/u);
  const adapt = new LiveLlmRun(planAtLabCeiling(profile({})), CREDENTIAL);
  assert.equal(adapt.createsFlow, false);
  adapt.assertLane({ flowLane: true, creation: false });
  assert.throws(() => adapt.assertLane({ flowLane: true, creation: true }), /An instruction task is built only by --llm-task create-flow, not adapt/u);
  // A dry run's description names where the key was found, never the key.
  const described = create.describe();
  assert.equal(described.purpose, "build_and_adapt");
  assert.deepEqual(described.credentialSource, { name: "DEEPSEEK_API_KEY", from: "test" });
  assert.equal(JSON.stringify(described).includes(CREDENTIAL.value), false);
});

/**
 * A chat build is held to the one per-build ceiling every build is held to,
 * from the same Core function this run computes its own from: the plan's
 * ceiling for a create-flow run with the profile's own limit is exactly
 * Core's, and a lower one the operator asked for, which cannot reach the Flow
 * the chat makes, is refused before anything starts.
 */
test("a chat build's per-build ceiling is Core's own, and a lower one that cannot reach the chat's Flow is refused", () => {
  const ceiling = LAB_CEILING_USD;
  const chat = new LiveLlmRun(planAtLabCeiling({ ...profile({}), task: "create-flow" }), CREDENTIAL);
  assert.equal(chat.describe().authorized.maxTotalEstimatedCostUsd, ceiling, "the run's ceiling and every build's come from one function");
  chat.assertChatBuildable();
  const lowered = new LiveLlmRun(planAtLabCeiling({ ...profile({ maxEstimatedCostUsd: ceiling / 2 }), task: "create-flow" }), CREDENTIAL);
  assert.equal(lowered.describe().authorized.maxTotalEstimatedCostUsd, ceiling / 2, "a direct build writes the lowered ceiling onto its Flow");
  assert.throws(() => lowered.assertChatBuildable(), (error: unknown) => error instanceof Error && error.message.includes(`held to FluxIQ's per-build ceiling of $${ceiling}, and --llm-max-cost-usd ${ceiling / 2} cannot reach the Flow the chat makes`));
});

// The chat build is held to the ceiling the Lab gave the run's Core
// (`--llm-cost-ceiling-usd`), not to the default the Lab's own process loaded.
test("a chat build passes at whatever ceiling the Lab started its Core with", () => {
  const raised = new LiveLlmRun(planLiveLlmExecution({ ...profile({}), task: "create-flow" }, LAB_CEILING_USD * 3), CREDENTIAL);
  raised.assertChatBuildable();
  assert.equal(raised.describe().authorized.maxTotalEstimatedCostUsd, LAB_CEILING_USD * 3);
});

test("a create-flow run's Flow repairs with the exploring intent, so its repair can be tried, applied and replayed", () => {
  const create = new LiveLlmRun(planAtLabCeiling({ ...profile({}), task: "create-flow" }), CREDENTIAL);
  // `explore_and_adapt` tries its repair rather than only proposing one, which
  // is what the wrong-answer route requires: under the narrow intent a run that
  // answered wrongly was refused.
  assert.deepEqual([create.repairsFlow, create.proposesRepairOnly], [true, false]);
  // The repair lane names the playback's intent; the dry run still describes the build's.
  assert.deepEqual(create.describeRepair(), { task: "create-flow", purpose: "explore_and_adapt" });
  assert.equal(create.describe().purpose, "build_and_adapt");
  const adapt = new LiveLlmRun(planAtLabCeiling(profile({})), CREDENTIAL);
  assert.deepEqual([adapt.repairsFlow, adapt.proposesRepairOnly, adapt.describeRepair()], [true, true, { task: "adapt", purpose: "diagnose_and_adapt" }]);
  const repair = new LiveLlmRun(planAtLabCeiling({ ...profile({}), task: "repair" }), CREDENTIAL);
  assert.deepEqual([repair.repairsFlow, repair.proposesRepairOnly, repair.describeRepair().purpose], [true, false, "explore_and_adapt"]);
  // A diagnosis changes nothing, so it has no repair to apply.
  const diagnose = new LiveLlmRun(planAtLabCeiling({ ...profile({}), task: "diagnose" }), CREDENTIAL);
  assert.deepEqual([diagnose.repairsFlow, diagnose.proposesRepairOnly], [false, false]);
});

test("a build run readies only a build, and a Flow run only a run", async () => {
  const create = new LiveLlmRun(planAtLabCeiling({ ...profile({}), task: "create-flow" }), CREDENTIAL);
  await assert.rejects(create.authorizer(fakeCore().control, { projectId: "project-1", authorizationPassword: "account-password" })("flow-1"), /A build_and_adapt run builds a Flow; it never runs one/u);
  const adapt = new LiveLlmRun(planAtLabCeiling(profile({})), CREDENTIAL);
  await assert.rejects(adapt.buildAuthorizer(fakeCore().control, { projectId: "project-1", authorizationPassword: "account-password" })("flow-1"), /A diagnose_and_adapt run cannot build a Flow/u);
});

const proposedBuild: CreatedFlowBuild = {
  outcome: "proposed",
  adaptationId: "adaptation-1",
  providerCalls: 5,
  providerInvocation: "attempted",
  accounting: { provider: "deepseek", model: DEFAULT_LLM_MODEL, inputTokens: 20_000, outputTokens: 3_000, totalTokens: 23_000, estimatedCostUsd: 0.02 },
  evidenceLoop: { decisionCount: 5, toolCallCount: 4, evidenceBytes: 9_000, toolIds: ["web.recovery.inspect"], steps: null },
  instructedConsequences: [],
  declaredConsequences: null,
  consequenceCrossCheck: null,
  permissionRequest: null,
  loopProviderCalls: 5,
  failure: null,
  recoveredAfterTimeout: false,
  durationMs: 40_000,
};

async function settleBuildOnce(build: CreatedFlowBuild, budget: Partial<LlmExecutionProfile["budget"]> = {}) {
  const core = fakeCore();
  // The whole per-request triple is the shared budget's. Overriding only the
  // output and total limits left the input limit at the default, and input plus
  // output may not exceed the total, so every build below was refused unrun.
  const run = new LiveLlmRun(planAtLabCeiling({ ...profile(budget), task: "create-flow" }), CREDENTIAL);
  const prepared = await run.buildAuthorizer(core.control, { projectId: "project-1", authorizationPassword: "account-password" })("flow-1");
  const written: Array<{ path: string; value: unknown }> = [];
  const published: Record<string, unknown>[] = [];
  const settle = () => run.settleBuild(build, { writeStructured: async (bundlePath, value) => { written.push({ path: bundlePath, value }); } }, async (details) => { published.push(details); });
  return { core, run, prepared, written, published, settle };
}

test("a create-flow run readies its build with its permitted consequences and records the build it settled", async () => {
  const { core, run, prepared, written, published, settle } = await settleBuildOnce(proposedBuild);
  await settle();
  assert.deepEqual(prepared, { permittedConsequences: [] });
  assert.equal(core.settingsRequests[0]?.flow.metadata.llmExecutionSettings.maxCalls, 26);
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

test("a refused build's content-free progress survives unchanged in the live snapshot", async () => {
  const progressStep = {
    toolId: "core.decision_amend_draft",
    iteration: 2,
    progress: { draftRevisionBefore: 2, draftRevisionAfter: 3, pageState: "unchanged", draftState: "changed", answerabilityState: "changed" },
    draftChange: { targetedStepIds: ["f1", "d2"], appliedCount: 1, refusedCount: 1, keptStepCount: 2, rerunStepId: "d2" },
    draft: { bytes: 2_048, budget: 8_192, steps: 2, instructionBytes: 384, withoutInput: 1 },
    answerability: { recordsRequested: true, recordProducerPresent: false, recordStorePresent: true, issueCode: "bootstrap.cannot_answer_instruction" },
  } as const;
  const refused: CreatedFlowBuild = {
    ...proposedBuild,
    outcome: "failed",
    adaptationId: null,
    evidenceLoop: { ...proposedBuild.evidenceLoop!, decisionCount: 5, toolCallCount: 4, steps: [progressStep] },
    failure: { code: "flow_bootstrap.evidence_unusable_decision", stage: "provider_output_validation", httpStatus: 400, issueCodes: ["bootstrap.cannot_answer_instruction"] },
  };
  const { written, settle } = await settleBuildOnce(refused);
  await settle();
  const snapshot = written.find(entry => entry.path === "snapshots/live-llm.json")?.value as Record<string, any>;
  assert.deepEqual(snapshot.build.evidenceLoop.steps, [progressStep]);
  const serialized = JSON.stringify(snapshot);
  for (const forbidden of ["Private instruction text", "data-testid=private-card", "http://127.0.0.1/private", "sha256:"]) assert.equal(serialized.includes(forbidden), false);
});

// `run-murzln6g-11debe1d`: the build stopped at its spending limit, left no
// proposal, and live-llm.json said `instructedConsequences: null` although
// `S/0015` had read them.
test("a build that left no proposal carries the consequences its step log read from the instructions, and says where they came from", async (t) => {
  const steps = await mkdtemp(path.join(os.tmpdir(), "fluxiq-live-llm-instructed-"));
  t.after(() => rm(steps, { recursive: true, force: true }));
  // `S/0015/decision.json`'s own list.
  const instructed = [
    { consequence: "modify_existing", quote: "Switch my pickup store to Millbrook Crossing Supercenter" },
    { consequence: "create_new", quote: "add two packs of the ValueRidge Essentials Select-A-Size Paper Towels in the 12 Double Rolls size and one pack of the ValueRidge Everyday Dinner Napkins in the 250 Count size to my cart, both for pickup" },
  ];
  await mkdir(path.join(steps, "0015-decide"));
  await writeFile(path.join(steps, "0015-decide", "meta.json"), JSON.stringify({ kind: "decide", provider: "deepseek", costUsd: 0.000379548, part: "creation", phase: "read" }));
  await writeFile(path.join(steps, "0015-decide", "decision.json"), JSON.stringify({ response: { decision: { kind: "complete", result: { instructed } } } }));
  const stopped: CreatedFlowBuild = { ...proposedBuild, outcome: "failed", adaptationId: null, instructedConsequences: null, failure: { code: "lab.chat_build_failed", stage: "chat", httpStatus: null } };
  const { run, written, settle } = await settleBuildOnce(stopped);
  run.readStepLogFrom(steps);
  const answered = await settle();
  const snapshot = written.find(entry => entry.path === "snapshots/live-llm.json")?.value as Record<string, any>;
  assert.deepEqual(snapshot.build.instructedConsequences, instructed);
  assert.equal(snapshot.instructedConsequencesFrom, "step_log");
  // The lane keeps what the settlement answers, so flow-lane.json holds the very record live-llm.json does.
  assert.equal(answered.build, snapshot.build);
  assert.equal(answered.instructedConsequencesFrom, "step_log");

  const fromProposal = await settleBuildOnce(proposedBuild);
  fromProposal.run.readStepLogFrom(steps);
  assert.deepEqual(await fromProposal.settle(), { build: proposedBuild, instructedConsequencesFrom: "proposal" });

  // A settlement that throws read the step log first and carries what it read
  // on the error, so flow-lane.json holds the record live-llm.json was given:
  // a build that reached no provider, and one over its run budget.
  for (const throwing of [
    { ...stopped, providerCalls: 0, providerInvocation: "not_attempted" as const, accounting: null, evidenceLoop: null },
    { ...stopped, accounting: { ...proposedBuild.accounting!, totalTokens: Number.MAX_SAFE_INTEGER } },
  ]) {
    const breached = await settleBuildOnce(throwing);
    breached.run.readStepLogFrom(steps);
    const error = await breached.settle().then(() => assert.fail("the settlement must throw"), (thrown: unknown) => thrown);
    assert.ok(error instanceof RunnerFailure);
    const written = breached.written.find(entry => entry.path === "snapshots/live-llm.json")?.value as Record<string, any>;
    assert.deepEqual(written.build.instructedConsequences, instructed);
    assert.equal(written.instructedConsequencesFrom, "step_log");
    assert.equal(settledBuildOf(error)?.build, written.build, "the error carries the very record live-llm.json holds");
    assert.equal(settledBuildOf(error)?.instructedConsequencesFrom, "step_log");
  }
  const proposed = fromProposal.written.find(entry => entry.path === "snapshots/live-llm.json")?.value as Record<string, any>;
  assert.deepEqual(proposed.build.instructedConsequences, [], "Core's own record is never replaced");
  assert.equal(proposed.instructedConsequencesFrom, "proposal");
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
  // One request past the run token budget, which for a build is every
  // authorized call at the per-request limit, so cost and the stall guard bind
  // before tokens do (`runTokenBudget` in live-llm-plan.ts).
  const buildBudget = PER_REQUEST * DEFAULT_LLM_LAB_BUDGET.maxCallsPerRun;
  const overspend = buildBudget + PER_REQUEST;
  const overspent = await settleBuildOnce({ ...proposedBuild, accounting: { ...proposedBuild.accounting!, totalTokens: overspend } });
  await assert.rejects(overspent.settle(), (error: unknown) => error instanceof RunnerFailure && error.category === "performance.budget" && new RegExp(`the run used ${overspend} total tokens against its run token budget of ${buildBudget}(?! \\()`, "u").test(error.message));
  const tooManyCalls = await settleBuildOnce({ ...proposedBuild, providerCalls: 27 });
  await assert.rejects(tooManyCalls.settle(), /the run made 27 provider call\(s\) against an authorized 26/u);
  const otherModel = await settleBuildOnce({ ...proposedBuild, accounting: { ...proposedBuild.accounting!, model: "deepseek-reasoner" } });
  await assert.rejects(otherModel.settle(), /Core's Flow build ran on deepseek\/deepseek-reasoner, not the authorized deepseek\/deepseek-flash/u);
});

// A created Flow's playback is readied for the model too, so a Flow that
// fails is repaired rather than refused for want of a model. It explores and
// tries its repair, and is bound by the same caps as the build; its spend is
// settled beside the build's, never folded into it.
test("a create-flow run repairs the Flow it built with explore_and_adapt, and settles that spend beside the build", async () => {
  const { core, run, written, published, settle } = await settleBuildOnce(proposedBuild);
  await settle();
  const execution = await run.repairAuthorizer(core.control, { projectId: "project-1", authorizationPassword: "account-password" })("flow-1");
  assert.deepEqual(execution, { intent: "explore_and_adapt", permittedConsequences: [] });
  // The playback's settings are the build's own: asking for the repair widens no limit. Only the mode
  // differs: the build stays `manual_approval`, and the playback runs `fully_adaptive`, so Core may
  // promote, resume and judge its repair rather than hold it as a proposal (t267 S1).
  const { adaptationMode: buildMode, ...buildSettings } = core.settingsRequests[0]?.flow.metadata ?? {};
  const { adaptationMode: playbackMode, ...playbackSettings } = core.settingsRequests[1]?.flow.metadata ?? {};
  assert.deepEqual(playbackSettings, buildSettings);
  assert.deepEqual([buildMode, playbackMode], ["manual_approval", "fully_adaptive"]);

  await run.settleRepair({ getRunDetail: async () => detail, automationStudioCall: async () => ({ runDetail: { metadata: {} } }) }, { projectId: "project-1", runId: "run-1" }, { writeStructured: async (bundlePath, value) => { written.push({ path: bundlePath, value }); } }, async (details) => { published.push(details); });
  const snapshot = written.filter(entry => entry.path === "snapshots/live-llm.json").at(-1)?.value as Record<string, any>;
  assert.deepEqual(snapshot.build, proposedBuild, "the build stays as settled");
  assert.equal(snapshot.observed.accounting.totalTokens, 23_000, "and its totals are not folded into the repair's");
  assert.equal(snapshot.repair.purpose, "explore_and_adapt");
  assert.equal(snapshot.repair.authorized.maxTotalEstimatedCostUsd, LAB_CEILING_USD);
  assert.equal(snapshot.repair.runId, "run-1");
  assert.equal(snapshot.repair.observed.calls, 3);
  assert.equal(snapshot.repair.observed.observedCalls.length, 3);
  assert.deepEqual(published.at(-1), { repair: { calls: 3, interventions: 3, totalEstimatedCostUsd: 0.003, llmGate: { invoked: true } }, runTotal: { calls: 8, totalEstimatedCostUsd: 0.023 } });
  assert.equal(run.usage.calls, 5 + 3, "the evaluation counts every call the run paid for");
  assert.equal(JSON.stringify(snapshot).includes(CREDENTIAL.value), false);
});

/**
 * The user's rule: a Flow build may spend Core's ceiling in all, and its repair
 * another ceiling of its own. `settleBuild` judges the build's record and
 * `settleRepair` the repair run's detail, each against the plan's total, so
 * neither phase's spend is counted against the other's, and neither may pass
 * the ceiling however many calls it was allowed.
 */
async function buildThenRepair(buildCostUsd: number, repairCostUsd: number) {
  const { core, run, settle } = await settleBuildOnce({ ...proposedBuild, accounting: { ...proposedBuild.accounting!, estimatedCostUsd: buildCostUsd } }, { maxCallsPerRun: 64, maxEstimatedCostUsd: LAB_CEILING_USD });
  const build = await settle().then(() => undefined, (error: unknown) => error);
  await run.repairAuthorizer(core.control, { projectId: "project-1", authorizationPassword: "account-password" })("flow-1");
  const repairDetail: ExistingRunDetail = {
    ...detail,
    interventions: detail.interventions!.map((intervention, _index, all) => ({ ...intervention, estimatedCostUsd: repairCostUsd / all.length })),
    llmAccounting: { ...detail.llmAccounting!, estimatedCostUsd: repairCostUsd },
  };
  const repair = await run.settleRepair({ getRunDetail: async () => repairDetail, automationStudioCall: async () => ({ runDetail: { metadata: {} } }) }, { projectId: "project-1", runId: "run-1" }, { writeStructured: async () => undefined }, async () => undefined)
    .then(() => undefined, (error: unknown) => error);
  return { core, build, repair };
}

function isCostBreach(error: unknown, spent: number): boolean {
  return error instanceof RunnerFailure && error.category === "performance.budget"
    && error.message.includes(`estimated cost ${spent} exceeded its per-build cost ceiling of ${LAB_CEILING_USD} `);
}

test("a build and its repair are each held to Core's ceiling on its own: 0.8 of it apiece passes, and either one over it fails", async () => {
  const under = Number((LAB_CEILING_USD * 0.8).toFixed(9));
  const over = Number((LAB_CEILING_USD * 1.04).toFixed(9));
  const within = await buildThenRepair(under, under);
  assert.equal(within.build, undefined, "a build at 0.8 of the ceiling is inside its own ceiling");
  assert.equal(within.repair, undefined, "and a repair at 0.8 inside its own, though the two come to 1.6 times it");
  // The Flow is configured with the ceiling for both phases: 64 calls at the ceiling still total the ceiling.
  assert.deepEqual(within.core.settingsRequests[0]?.flow.metadata.adaptationPolicySettings, { maxEstimatedCostUsdPerRun: LAB_CEILING_USD });
  assert.deepEqual(within.core.settingsRequests[1]?.flow.metadata.adaptationPolicySettings, { maxEstimatedCostUsdPerRun: LAB_CEILING_USD });

  const buildOver = await buildThenRepair(over, under);
  assert.ok(isCostBreach(buildOver.build, over), `a build over the ceiling fails on its own: ${String(buildOver.build)}`);
  assert.equal(buildOver.repair, undefined, "and does not count against its repair");

  const repairOver = await buildThenRepair(under, over);
  assert.equal(repairOver.build, undefined);
  assert.ok(isCostBreach(repairOver.repair, over), `a repair over the ceiling fails on its own: ${String(repairOver.repair)}`);
});

/**
 * Core judges a finished run's result after the run, outside its run budget,
 * and asks a `does not answer` a second time with the same evidence. Those
 * calls are paid for and are in no per-call line, so the snapshot lists them
 * from the run's interventions, which Core marks as verification.
 */
const verifiedRunDetail = {
  runDetail: {
    metadata: {
      resultVerification: {
        status: "unverified",
        performed: true,
        verdict: "unsure",
        basis: "model_disagreed",
        code: "core.result.verdicts_disagree",
        reason: "The two checks of this result disagreed.",
        observation: "14 records stored, across 1 record set.",
        verdicts: ["does_not_answer", "answers"],
        calls: 2,
      },
    },
    interventions: [
      { interventionId: "i-recovery", kind: "diagnosis", tokenUsage: { inputTokens: 900, outputTokens: 100, totalTokens: 1_000, estimatedCostUsd: 0.001 }, validation: { ok: true, issues: [] }, metadata: { requestId: "llm.runtime_diagnosis.a" } },
      { interventionId: "i-verify-1", kind: "diagnosis", tokenUsage: { inputTokens: 1_944, outputTokens: 300, totalTokens: 2_244, estimatedCostUsd: 0.00125 }, validation: { ok: true, issues: [] }, metadata: { requestId: "llm.loop_verification.b", source: "verifyAutomationStudioRunResult", verificationCheck: 1 } },
      { interventionId: "i-verify-2", kind: "diagnosis", tokenUsage: { inputTokens: 1_944, outputTokens: 280, totalTokens: 2_224, estimatedCostUsd: 0.00123 }, validation: { ok: true, issues: [] }, metadata: { requestId: "llm.loop_verification.c", source: "verifyAutomationStudioRunResult", verificationCheck: 2 } },
    ],
  },
};

test("a created Flow's playback lists every result-verification call Core made, and none of its prose", async () => {
  const { core, run, written, settle } = await settleBuildOnce(proposedBuild);
  await settle();
  await run.repairAuthorizer(core.control, { projectId: "project-1", authorizationPassword: "account-password" })("flow-1");
  const endpoints: string[] = [];
  const control = { getRunDetail: async () => detail, automationStudioCall: async (endpoint: string) => { endpoints.push(endpoint); return verifiedRunDetail; } };
  await run.settleRepair(control, { projectId: "project-1", runId: "run-1" }, { writeStructured: async (bundlePath, value) => { written.push({ path: bundlePath, value }); } }, async () => undefined);
  const snapshot = written.filter(entry => entry.path === "snapshots/live-llm.json").at(-1)?.value as Record<string, any>;
  assert.ok(endpoints.every(endpoint => endpoint === "get-flow-run-detail"));
  assert.deepEqual(snapshot.verification, {
    source: "run-detail",
    status: "unverified",
    basis: "model_disagreed",
    code: "core.result.verdicts_disagree",
    verdicts: ["does_not_answer", "answers"],
    recordedCalls: 2,
    calls: 2,
    interventions: [
      { check: 1, requestId: "llm.loop_verification.b", validationOk: true, inputTokens: 1_944, outputTokens: 300, totalTokens: 2_244, estimatedCostUsd: 0.00125 },
      { check: 2, requestId: "llm.loop_verification.c", validationOk: true, inputTokens: 1_944, outputTokens: 280, totalTokens: 2_224, estimatedCostUsd: 0.00123 },
    ],
    totalEstimatedCostUsd: 0.00125 + 0.00123,
  });
  assert.equal(JSON.stringify(snapshot).includes("disagreed."), false, "Core's reason sentence is not copied into the bundle");
  assert.equal(snapshot.repair.observed.calls, 3, "the repair's own accounting is unchanged by the verification record");
});

test("a verification record that cannot be read says so, and settles the run all the same", async () => {
  const { core, run, written, settle } = await settleBuildOnce(proposedBuild);
  await settle();
  await run.repairAuthorizer(core.control, { projectId: "project-1", authorizationPassword: "account-password" })("flow-1");
  const control = { getRunDetail: async () => detail, automationStudioCall: async (): Promise<unknown> => { throw new Error("gone"); } };
  await run.settleRepair(control, { projectId: "project-1", runId: "run-1" }, { writeStructured: async (bundlePath, value) => { written.push({ path: bundlePath, value }); } }, async () => undefined);
  const snapshot = written.filter(entry => entry.path === "snapshots/live-llm.json").at(-1)?.value as Record<string, any>;
  assert.equal(snapshot.verification.source, "unreadable");
  assert.equal(snapshot.verification.calls, 0);
  assert.equal(snapshot.repair.observed.calls, 3);
});

test("only a create-flow run readies a repair of the Flow it built, and a repair that cannot be read back is recorded, not raised", async () => {
  const adapt = new LiveLlmRun(planAtLabCeiling(profile({})), CREDENTIAL);
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

/**
 * `run-munw7ffn-fe1cecd2`, as Core recorded it: a 22-call build, a playback
 * whose answer was judged wrong twice, and a 36-call re-author. The Lab's
 * `observed.totalEstimatedCostUsd` -- the figure the machine's spend ledger
 * records -- was the build's $0.0418 alone, and `llm.calls` was 24, although
 * the run made 60 calls for about $0.0861.
 */
const JUDGE_1 = "llm.loop_verification.ebec2a7a-d161-4541-8176-8172589d34db";
const JUDGE_2 = "llm.loop_verification.6cc3d182-9071-4703-a26e-b025de3b3b8a";
const reauthoredBuild: CreatedFlowBuild = {
  ...proposedBuild,
  providerCalls: 22,
  loopProviderCalls: 21,
  accounting: { provider: "deepseek", model: DEFAULT_LLM_MODEL, inputTokens: 310_347, outputTokens: 5_531, totalTokens: 315_878, estimatedCostUsd: 0.04178802 },
};
/** The playback's parsed detail: no accounting and no per-call lines, so it is read from its interventions, the two checks among them. */
const { llmAccounting: _noAccounting, ...detailWithoutAccounting } = detail;
const reauthoredPlayback: ExistingRunDetail = {
  ...detailWithoutAccounting,
  interventions: [
    { interventionId: "i-judge-1", kind: "diagnosis", requestId: JUDGE_1, provider: "deepseek", model: DEFAULT_LLM_MODEL, validationOk: true, inputTokens: 2_991, outputTokens: 511, totalTokens: 3_502, estimatedCostUsd: 0.001247076 },
    { interventionId: "i-judge-2", kind: "diagnosis", requestId: JUDGE_2, provider: "deepseek", model: DEFAULT_LLM_MODEL, validationOk: true, inputTokens: 2_991, outputTokens: 428, totalTokens: 3_419, estimatedCostUsd: 0.000582996 },
    { interventionId: "i-ladder", kind: "diagnosis", validationOk: false, validationCodes: ["recovery.ladder_diagnosis_unanswered"] },
  ],
};
function reauthoredRawDetail(attempts: unknown[]) {
  return {
    runDetail: {
      summary: { runId: "run-1", projectId: "project-1", flowId: "flow-1", status: "failed" },
      metadata: {
        resultVerification: { status: "refuted", basis: "model", code: "core.result.does_not_answer_request", verdicts: ["does_not_answer", "does_not_answer"], calls: 2 },
        resultReauthor: { routed: true, applied: true, attempts },
      },
      interventions: [
        { interventionId: "i-judge-1", kind: "diagnosis", tokenUsage: { inputTokens: 2_991, outputTokens: 511, totalTokens: 3_502, estimatedCostUsd: 0.001247076 }, validation: { ok: true }, metadata: { requestId: JUDGE_1, source: "verifyAutomationStudioRunResult", verificationCheck: 1 } },
        { interventionId: "i-judge-2", kind: "diagnosis", tokenUsage: { inputTokens: 2_991, outputTokens: 428, totalTokens: 3_419, estimatedCostUsd: 0.000582996 }, validation: { ok: true }, metadata: { requestId: JUDGE_2, source: "verifyAutomationStudioRunResult", verificationCheck: 2 } },
      ],
    },
  };
}
const REAUTHOR_ID = "adaptation.bootstrap.2b83be32-6264-481a-baec-e18bf3dc3922";
const appliedReauthor = { attempt: 1, routed: true, adaptationId: REAUTHOR_ID, applied: true, durationMs: 173_400, accounting: { requestId: "evidence.aa628a38", provider: "deepseek", model: DEFAULT_LLM_MODEL, inputTokens: 441_137, outputTokens: 10_071, totalTokens: 451_208, estimatedCostUsd: 0.042481212 } };
const reauthorAdaptation = () => ({ adaptation: { evidenceLoop: { providerCallCount: 35, additionalProviderCallCount: 1, totalProviderCallCount: 36 } } });

async function settleReauthoredRun(attempts: unknown[], adaptation: () => unknown = reauthorAdaptation, stepsDirectory?: string) {
  const { core, run, written, published, settle } = await settleBuildOnce(reauthoredBuild, { maxCallsPerRun: 48 });
  if (stepsDirectory) run.readStepLogFrom(stepsDirectory);
  await settle();
  await run.repairAuthorizer(core.control, { projectId: "project-1", authorizationPassword: "account-password" })("flow-1");
  const reads: Array<{ endpoint: string; payload: Record<string, unknown> }> = [];
  const control = {
    getRunDetail: async () => reauthoredPlayback,
    automationStudioCall: async (endpoint: string, payload: Record<string, unknown>) => {
      reads.push({ endpoint, payload });
      if (endpoint === "get-flow-run-detail") return reauthoredRawDetail(attempts);
      if (endpoint === "get-flow-adaptation") return adaptation();
      throw new Error(`unexpected endpoint ${endpoint}`);
    },
  };
  await run.settleRepair(control, { projectId: "project-1", runId: "run-1" }, { writeStructured: async (bundlePath, value) => { written.push({ path: bundlePath, value }); } }, async (details) => { published.push(details); });
  const snapshot = written.filter(entry => entry.path === "snapshots/live-llm.json").at(-1)?.value as Record<string, any>;
  return { run, snapshot, published, reads };
}

test("a run that re-authored reports every call it made -- build, checks and re-author -- in the total the spend ledger reads", async () => {
  const { run, snapshot, published, reads } = await settleReauthoredRun([appliedReauthor]);
  // The ledger's figure (`scripts/lab/live-guards/run-outcomes.mjs`) is the whole run's.
  assert.equal(snapshot.observed.totalEstimatedCostUsd, 0.086099304);
  assert.equal(snapshot.observed.calls, 60);
  assert.equal(run.usage.calls, 60, "the evaluation's llm.calls counts the re-author too");
  // Each phase stays readable on its own; the two checks are counted once, as the judge's.
  assert.deepEqual(snapshot.runSpend.phases, {
    build: { calls: 22, estimatedCostUsd: 0.04178802 },
    runtime: { calls: 0, estimatedCostUsd: 0 },
    judge: { calls: 2, estimatedCostUsd: 0.001830072 },
    reauthor: { calls: 36, estimatedCostUsd: 0.042481212 },
    chat: null,
    read: null,
  });
  assert.deepEqual(snapshot.observed.phases, snapshot.runSpend.phases);
  assert.deepEqual(snapshot.reauthor.attempts, [{ attempt: 1, adaptationId: REAUTHOR_ID, calls: 36, callsFrom: "adaptation", inputTokens: 441_137, outputTokens: 10_071, estimatedCostUsd: 0.042481212 }]);
  // The per-phase records a campaign sums are left as they were.
  assert.equal(snapshot.observed.accounting.estimatedCostUsd, 0.04178802, "the build's own accounting is not rewritten");
  // The two checks are the judge's, not the playback's repair: what is left is the ladder's unanswered rung, which called nothing.
  assert.equal(snapshot.repair.observed.calls, 0);
  assert.deepEqual(published.slice(-2), [
    { repair: { calls: 0, interventions: 1, totalEstimatedCostUsd: 0, llmGate: { invoked: true } }, runTotal: { calls: 60, totalEstimatedCostUsd: 0.086099304 } },
    { resultChecks: { calls: 2, totalEstimatedCostUsd: 0.001830072, status: "refuted" }, runTotal: { calls: 60, totalEstimatedCostUsd: 0.086099304 } },
  ]);
  // The succeeded attempt's count is read from its adaptation, on the run's own Flow.
  assert.deepEqual(reads.filter(read => read.endpoint === "get-flow-adaptation").map(read => read.payload), [{ projectId: "project-1", flowId: "flow-1", adaptationId: REAUTHOR_ID }]);
});

test("a re-author's retries are counted too, and an attempt whose calls cannot be read still adds its cost and says so", async () => {
  const failedRetry = { attempt: 2, routed: true, code: "flow_bootstrap.evidence_unusable_decision", accounting: { inputTokens: 40_000, outputTokens: 900, estimatedCostUsd: 0.004 }, evidenceLoop: { decisionCount: 4, totalProviderCallCount: 5 } };
  const counted = await settleReauthoredRun([appliedReauthor, failedRetry]);
  assert.equal(counted.snapshot.runSpend.phases.reauthor.calls, 36 + 5);
  assert.deepEqual(counted.snapshot.reauthor.attempts.map((attempt: { callsFrom: string }) => attempt.callsFrom), ["adaptation", "loop"]);
  assert.equal(counted.snapshot.observed.calls, 22 + 2 + 41);
  assert.equal(counted.snapshot.observed.totalEstimatedCostUsd, 0.090099304);
  // The retry's count came from its own loop, so only the applied attempt was read from an adaptation.
  assert.equal(counted.reads.filter(read => read.endpoint === "get-flow-adaptation").length, 1);

  const unreadable = await settleReauthoredRun([appliedReauthor], () => { throw new Error("gone"); });
  assert.equal(unreadable.snapshot.reauthor.attempts[0].calls, null);
  assert.equal(unreadable.snapshot.reauthor.attempts[0].callsFrom, "adaptation_unreadable");
  assert.equal(unreadable.snapshot.observed.totalEstimatedCostUsd, 0.086099304, "its cost is Core's accounting and still counted");
  assert.deepEqual(unreadable.snapshot.runSpend.uncountedPhases, ["reauthor"]);
  assert.deepEqual(unreadable.published.at(-1)?.runTotal, { calls: 24, totalEstimatedCostUsd: 0.086099304, uncountedPhases: ["reauthor"] });
});

/** A step log as Core writes one: a folder per step, `meta.json` last; tool steps name no provider. */
async function writeStepLog(t: test.TestContext, steps: Array<[kind: string, costUsd: number | null]>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-live-run-steps-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const [index, [kind, costUsd]] of steps.entries()) {
    const folder = path.join(root, `${String(index + 1).padStart(4, "0")}-${kind}`);
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "meta.json"), JSON.stringify(kind.startsWith("tool-") ? { kind: "tool" } : { kind, provider: "deepseek", model: DEFAULT_LLM_MODEL, costUsd }));
  }
  return root;
}

// `run-muqk713g-d08ad3dc`: `llm.calls` 17 and a ledger $0.12085128, while its
// step log held 35 provider calls for $0.121157 -- the failed re-author's 17
// calls, which Core recorded a cost for and no count, and the chat's own call.
test("a run whose step log Core wrote counts every call in it -- the chat's and an uncounted re-author's -- in llm.calls and the ledger's total", async (t) => {
  const steps: Array<[string, number | null]> = [
    ["chat", 0.0003],
    ["decide", 0.04178802], ...Array.from({ length: 21 }, (): [string, number] => ["decide", 0]),
    ["tool-core.run_node", null],
    ["judge", 0.001247076], ["judge", 0.000582996],
    ["decide", 0.042481212], ...Array.from({ length: 35 }, (): [string, number] => ["decide", 0]),
  ];
  const { run, snapshot, published } = await settleReauthoredRun([appliedReauthor], () => { throw new Error("gone"); }, await writeStepLog(t, steps));
  assert.equal(snapshot.observed.calls, 1 + 22 + 2 + 36);
  assert.equal(snapshot.observed.totalEstimatedCostUsd, 0.086399304);
  assert.equal(run.usage.calls, 61, "the evaluation's llm.calls is the step log's count");
  assert.deepEqual(snapshot.runSpend.phases.chat, { calls: 1, estimatedCostUsd: 0.0003 });
  assert.deepEqual(snapshot.runSpend.phases.reauthor, { calls: 36, estimatedCostUsd: 0.042481212 });
  assert.deepEqual(snapshot.runSpend.uncountedPhases, []);
  assert.deepEqual(snapshot.runSpend.stepLog, { calls: 61, estimatedCostUsd: 0.086399304, filledReauthorCalls: 36, unattributed: { calls: 0, estimatedCostUsd: 0 }, fromBuild: { judge: { calls: 0, estimatedCostUsd: 0 }, read: { calls: 0, estimatedCostUsd: 0 }, calls: 0, estimatedCostUsd: 0 } });
  assert.deepEqual(published.at(-1)?.runTotal, { calls: 61, totalEstimatedCostUsd: 0.086399304 });
});

// `run-mup2u8o3-6697c4be`: the build ended without a Flow
// (`flow_bootstrap.evidence_budget_exhausted`) after spending $0.2969 of its
// ceiling, then $0.25: about 1.19 times it. The breach was thrown before the
// lane saw the build, so the product's failure was lost and the run was
// stamped a facility failure. The test keeps that proportion to Core's ceiling.
test("a build that ended without a Flow over its cost ceiling fails on the budget and carries the build's own failure", async () => {
  const spent = Number((LAB_CEILING_USD * 1.18775841599).toFixed(9));
  const overspentWithoutFlow: CreatedFlowBuild = {
    ...proposedBuild,
    outcome: "failed",
    adaptationId: null,
    providerCalls: 9,
    accounting: { ...proposedBuild.accounting!, estimatedCostUsd: spent },
    failure: { code: "flow_bootstrap.evidence_budget_exhausted", stage: null, httpStatus: null },
  };
  const { settle } = await settleBuildOnce(overspentWithoutFlow, { maxCallsPerRun: 64, maxEstimatedCostUsd: LAB_CEILING_USD });
  const error = await settle().then(() => undefined, (caught: unknown) => caught);
  assert.ok(isCostBreach(error, spent), `the category stays the budget's: ${String(error)}`);
  const cause = (error as RunnerFailure).cause;
  assert.ok(cause instanceof RunnerFailure && cause.category === "runtime.behavior", "the build without a Flow is kept as the cause");
  assert.equal((cause.details?.failure as { code?: string } | undefined)?.code, "flow_bootstrap.evidence_budget_exhausted");

  // A build that did propose a Flow and overspent carries nothing: the lane goes on to judge it.
  const { settle: settleProposed } = await settleBuildOnce({ ...proposedBuild, accounting: { ...proposedBuild.accounting!, estimatedCostUsd: spent } }, { maxCallsPerRun: 64, maxEstimatedCostUsd: LAB_CEILING_USD });
  const proposedError = await settleProposed().then(() => undefined, (caught: unknown) => caught);
  assert.ok(isCostBreach(proposedError, spent));
  assert.equal((proposedError as RunnerFailure).cause, undefined);
});

// run-murwd8le-79e735a8 (Cause 12): a playback that needed no recovery, whose
// result Core checked twice. The two checks were published as the playback's
// `repair` (2 calls, "The created Flow's repair attempt finished") although no
// diagnosis or repair ran. They are now `verification`'s alone: the repair
// lists recovery only, and the checks settle with an event of their own. The
// run's spend is the same figure either way.
const { llmAccounting: _checkedNoAccounting, ...checkedBase } = detail;
const checkedPlayback: ExistingRunDetail = {
  ...checkedBase,
  interventions: [
    { interventionId: "i-recovery", kind: "diagnosis", requestId: "llm.runtime_diagnosis.a", provider: "deepseek", model: DEFAULT_LLM_MODEL, validationOk: true, inputTokens: 900, outputTokens: 100, totalTokens: 1_000, estimatedCostUsd: 0.001 },
    { interventionId: "i-verify-1", kind: "diagnosis", requestId: "llm.loop_verification.b", provider: "deepseek", model: DEFAULT_LLM_MODEL, validationOk: true, inputTokens: 1_944, outputTokens: 300, totalTokens: 2_244, estimatedCostUsd: 0.00125 },
    { interventionId: "i-verify-2", kind: "diagnosis", requestId: "llm.loop_verification.c", provider: "deepseek", model: DEFAULT_LLM_MODEL, validationOk: true, inputTokens: 1_944, outputTokens: 280, totalTokens: 2_224, estimatedCostUsd: 0.00123 },
  ],
};

async function settleChecked(playback: ExistingRunDetail, raw: unknown) {
  const { core, run, written, published, settle } = await settleBuildOnce(proposedBuild);
  await settle();
  await run.repairAuthorizer(core.control, { projectId: "project-1", authorizationPassword: "account-password" })("flow-1");
  published.length = 0;
  await run.settleRepair({ getRunDetail: async () => playback, automationStudioCall: async () => raw }, { projectId: "project-1", runId: "run-1" }, { writeStructured: async (bundlePath, value) => { written.push({ path: bundlePath, value }); } }, async (details) => { published.push(details); });
  const snapshot = written.filter(entry => entry.path === "snapshots/live-llm.json").at(-1)?.value as Record<string, any>;
  return { run, snapshot, published };
}

test("a playback's result checks are not its repair: the repair lists recovery only, the checks get their own event, and the spend is unchanged", async () => {
  const { run, snapshot, published } = await settleChecked(checkedPlayback, verifiedRunDetail);
  assert.equal(snapshot.repair.observed.calls, 1, "only the recovery's call is the repair's");
  assert.equal(snapshot.repair.observed.interventions, 1);
  assert.deepEqual(snapshot.repair.observed.observedCalls.map((call: { requestId: string }) => call.requestId), ["llm.runtime_diagnosis.a"]);
  assert.equal(snapshot.repair.observed.totalEstimatedCostUsd, 0.001);
  assert.deepEqual(snapshot.repair.resultChecks, { calls: 2, totalEstimatedCostUsd: 0.00248, record: "verification" });
  assert.equal(snapshot.verification.calls, 2, "the checks' own record lists them");
  // The whole run: build 5 calls $0.02, recovery 1 call $0.001, checks 2 calls $0.00248 -- as before the split.
  assert.deepEqual(snapshot.runSpend.phases.runtime, { calls: 1, estimatedCostUsd: 0.001 });
  assert.deepEqual(snapshot.runSpend.phases.judge, { calls: 2, estimatedCostUsd: 0.00248 });
  assert.equal(snapshot.observed.calls, 8);
  assert.equal(snapshot.observed.totalEstimatedCostUsd, 0.02348);
  assert.equal(run.usage.calls, 8);
  assert.deepEqual(published, [
    { repair: { calls: 1, interventions: 1, totalEstimatedCostUsd: 0.001, llmGate: { invoked: true } }, runTotal: { calls: 8, totalEstimatedCostUsd: 0.02348 } },
    { resultChecks: { calls: 2, totalEstimatedCostUsd: 0.00248, status: "unverified" }, runTotal: { calls: 8, totalEstimatedCostUsd: 0.02348 } },
  ]);
});

test("a playback that only had its result checked publishes the check and no repair", async () => {
  const { llmGate: _noGate, ...ungated } = checkedPlayback;
  const onlyChecked: ExistingRunDetail = { ...ungated, interventions: checkedPlayback.interventions!.slice(1) };
  const raw = { runDetail: { ...verifiedRunDetail.runDetail, interventions: verifiedRunDetail.runDetail.interventions.slice(1) } };
  const { snapshot, published } = await settleChecked(onlyChecked, raw);
  assert.deepEqual({ calls: snapshot.repair.observed.calls, interventions: snapshot.repair.observed.interventions, observedCalls: snapshot.repair.observed.observedCalls, cost: snapshot.repair.observed.totalEstimatedCostUsd }, { calls: 0, interventions: 0, observedCalls: [], cost: 0 });
  assert.equal(snapshot.observed.totalEstimatedCostUsd, 0.02248);
  assert.deepEqual(published, [{ resultChecks: { calls: 2, totalEstimatedCostUsd: 0.00248, status: "unverified" }, runTotal: { calls: 7, totalEstimatedCostUsd: 0.02248 } }]);
});
