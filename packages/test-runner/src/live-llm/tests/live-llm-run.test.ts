import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DEFAULT_LLM_PROVIDER, DEFAULT_LLM_LAB_BUDGET, DEFAULT_LLM_MODEL, LLM_LAB_SCHEMA_VERSION, type LlmExecutionProfile } from "@fluxiq-web-extension/test-contracts";
import type { ExistingFlowSpend, ExistingRunDetail } from "../../existing-fluxiq-control.js";
import { RunnerFailure } from "../../failure.js";
import { settledBuildOf, type CreatedFlowBuild } from "../../flow-lane/index.js";
import { flowPurse } from "./flow-purse.js";
import { LAB_CEILING_USD, planAtLabCeiling } from "./lab-ceiling.js";
import { planLiveLlmExecution } from "../live-llm-plan.js";
import { beginLiveLlmRun, LiveLlmRun } from "../live-llm-run.js";

/**
 * One live run end to end against a fake Core: ready the build and the created
 * Flow's playback, settle each, and read back `snapshots/live-llm.json`. The
 * fake answers only the endpoints a live run uses; any other request fails the
 * test. Its Flow purse (`get-flow-spend`) is what the test sets it to: by
 * default the build's five calls, as Core records them when the build settles.
 */

const PER_REQUEST = DEFAULT_LLM_LAB_BUDGET.maxTotalTokensPerRequest;

const CREDENTIAL = { name: "CLAUDE_API_KEY", source: "test", value: "test-provider-credential-value" };

function profile(budget: Partial<LlmExecutionProfile["budget"]>): LlmExecutionProfile {
  return {
    schemaVersion: LLM_LAB_SCHEMA_VERSION,
    profileId: "lab-adapt",
    mode: "live",
    provider: DEFAULT_LLM_PROVIDER,
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

function fakeCore(purse: ExistingFlowSpend | null = flowPurse({ build: [5, 0.02] })) {
  const settingsRequests: Array<Record<string, any>> = [];
  let metadata: unknown;
  const core = {
    settingsRequests,
    purse,
    control: {
      async getFlowSpend(): Promise<ExistingFlowSpend | null> { return core.purse; },
      async reauthenticate(): Promise<void> {},
      async secretKeysCall(endpoint: string, payload: Record<string, unknown>): Promise<unknown> {
        if (endpoint === "snapshot") return { keys: [] };
        return { id: "key-1", name: payload.name, kind: "llm", provider: payload.provider, metadata: payload.metadata, scope: "global", enabled: true };
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
  return core;
}

/** A settlement's reader: the run detail and raw reads given, and the fake Core's Flow purse. */
function reader<T extends object>(core: ReturnType<typeof fakeCore>, reads: T): T & { getFlowSpend: () => Promise<ExistingFlowSpend | null> } {
  return { getFlowSpend: core.control.getFlowSpend, ...reads };
}

/** Three real-looking calls: more than the Lab used to allow, well inside every cap. */
const detail: ExistingRunDetail = {
  summary: { runId: "run-1", projectId: "project-1", flowId: "flow-1", status: "failed", routeDecisionCount: 0, subflowEntryCount: 0, actionAttemptCount: 1, updatedAt: 1 },
  routeDecisions: [],
  subflows: [],
  actionAttempts: [],
  interventions: [
    { interventionId: "i-1", kind: "diagnosis", provider: DEFAULT_LLM_PROVIDER, model: DEFAULT_LLM_MODEL, validationOk: true, inputTokens: 900, outputTokens: 100, totalTokens: 1_000, estimatedCostUsd: 0.001 },
    { interventionId: "i-2", kind: "diagnosis", provider: DEFAULT_LLM_PROVIDER, model: DEFAULT_LLM_MODEL, validationOk: true, inputTokens: 900, outputTokens: 100, totalTokens: 1_000, estimatedCostUsd: 0.001 },
    { interventionId: "i-3", kind: "runtime_patch", provider: DEFAULT_LLM_PROVIDER, model: DEFAULT_LLM_MODEL, validationOk: true, inputTokens: 900, outputTokens: 100, totalTokens: 1_000, estimatedCostUsd: 0.001 },
  ],
  llmAccounting: { calls: 3, inputTokens: 2_700, outputTokens: 300, totalTokens: 3_000, estimatedCostUsd: 0.003, budgetBreaches: 0, pendingCalls: 0 },
  llmGate: { invoked: true },
};

test("a run's --llm-permit travels with its build and is recorded, and a typed token budget is kept", async () => {
  const core = fakeCore();
  const run = new LiveLlmRun(planAtLabCeiling({ ...profile({ maxTotalTokensPerRun: PER_REQUEST * 3 }), task: "create-flow", permittedConsequences: ["create_new", "send_or_publish"] }), CREDENTIAL);
  const prepared = await run.buildAuthorizer(core.control, { projectId: "project-1", authorizationPassword: "account-password" })("flow-1");
  assert.deepEqual(prepared, { permittedConsequences: ["send_or_publish", "create_new"] });
  assert.deepEqual(run.describe().permittedConsequences, ["send_or_publish", "create_new"]);
  assert.equal(run.describe().authorized.maxTotalTokensPerRun, PER_REQUEST * 3);
});

async function noKeyRepository(t: test.TestContext): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-live-run-no-key-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("a live run refuses before a credential is read when its task or target does not fit", async (t) => {
  const repositoryRoot = await noKeyRepository(t);
  const begin = (task: LlmExecutionProfile["task"], targetMode: string) => beginLiveLlmRun({ profile: { ...profile({}), task }, repositoryRoot, environment: {}, targetMode });
  const retired = (error: unknown) => error instanceof RunnerFailure && error.category === "recording.contract" && error.details?.code === "automation.instruction_led_authoring_required";
  // The tasks that ran only on the retired recording-built Flow lane are refused by name with the path that replaced them.
  for (const task of ["diagnose", "adapt", "repair"] as const) {
    await assert.rejects(begin(task, "isolated"), retired, task);
    await assert.rejects(begin(task, "isolated"), new RegExp(`--llm-task ${task} ran against a Flow built from the run's recording[^]*--llm-task create-flow --instruction-task <task>[^]*pnpm lab replay`, "u"));
  }
  for (const targetMode of ["existing", "clone"]) {
    await assert.rejects(begin("create-flow", targetMode), new RegExp(`the ${targetMode} target's is not; use --target isolated or persistent-isolated`, "u"));
  }
  // Only once the task and the target fit does the missing credential refuse.
  await assert.rejects(begin("create-flow", "isolated"), (error: unknown) => error instanceof RunnerFailure && error.category === "environment.missing" && /CLAUDE_API_KEY is not set/u.test(error.message));
});

test("a create-flow run fits only a scenario run that carries an instruction task, and no other task fits any", () => {
  const create = new LiveLlmRun(planAtLabCeiling({ ...profile({}), task: "create-flow" }), CREDENTIAL);
  assert.equal(create.createsFlow, true);
  create.assertLane({ creation: true });
  assert.throws(() => create.assertLane({ creation: false }), /needs an instruction task to build from/u);
  const adapt = new LiveLlmRun(planAtLabCeiling(profile({})), CREDENTIAL);
  assert.equal(adapt.createsFlow, false);
  for (const lane of [{ creation: false }, { creation: true }]) assert.throws(() => adapt.assertLane(lane), /--llm-task adapt ran against a Flow built from the run's recording/u);
  // A dry run's description names where the key was found, never the key.
  const described = create.describe();
  assert.equal(described.purpose, "build_and_adapt");
  assert.deepEqual(described.credentialSource, { name: "CLAUDE_API_KEY", from: "test" });
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
  assert.equal(create.repairsFlow, true);
  // The repair lane names the playback's intent; the dry run still describes the build's.
  assert.deepEqual(create.describeRepair(), { task: "create-flow", purpose: "explore_and_adapt" });
  assert.equal(create.describe().purpose, "build_and_adapt");
  const adapt = new LiveLlmRun(planAtLabCeiling(profile({})), CREDENTIAL);
  assert.deepEqual([adapt.repairsFlow, adapt.describeRepair()], [true, { task: "adapt", purpose: "diagnose_and_adapt" }]);
  const repair = new LiveLlmRun(planAtLabCeiling({ ...profile({}), task: "repair" }), CREDENTIAL);
  assert.deepEqual([repair.repairsFlow, repair.describeRepair().purpose], [true, "explore_and_adapt"]);
  // A diagnosis changes nothing, so it has no repair to apply.
  const diagnose = new LiveLlmRun(planAtLabCeiling({ ...profile({}), task: "diagnose" }), CREDENTIAL);
  assert.equal(diagnose.repairsFlow, false);
});

test("only a build run readies a build", async () => {
  const adapt = new LiveLlmRun(planAtLabCeiling(profile({})), CREDENTIAL);
  await assert.rejects(adapt.buildAuthorizer(fakeCore().control, { projectId: "project-1", authorizationPassword: "account-password" })("flow-1"), /A diagnose_and_adapt run cannot build a Flow/u);
});

const proposedBuild: CreatedFlowBuild = {
  outcome: "proposed",
  adaptationId: "adaptation-1",
  providerCalls: 5,
  providerInvocation: "attempted",
  accounting: { provider: DEFAULT_LLM_PROVIDER, model: DEFAULT_LLM_MODEL, inputTokens: 20_000, outputTokens: 3_000, totalTokens: 23_000, estimatedCostUsd: 0.02 },
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

async function settleBuildOnce(build: CreatedFlowBuild, budget: Partial<LlmExecutionProfile["budget"]> = {}, purse?: ExistingFlowSpend | null) {
  const core = fakeCore(purse);
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
  // The run's spend ceiling is a Flow setting, saved with the rest.
  assert.deepEqual(core.settingsRequests[0]?.flow.metadata.adaptationPolicySettings, { maxEstimatedCostUsdPerRun: LAB_CEILING_USD });
  assert.equal(core.settingsRequests[0]?.flow.metadata.llmModel, DEFAULT_LLM_MODEL);
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
  assert.equal(snapshot.runSpend.source, "flow_purse");
  assert.deepEqual(snapshot.runSpend.phases.build, { calls: 5, estimatedCostUsd: 0.02 });
  assert.deepEqual([snapshot.runSpend.largestInputTokens, snapshot.runSpend.byRole], [null, null], "this purse kept no tallies");
});

// A8: a project build's largest call input and per-role spend reach the snapshot from Core's purse.
test("the snapshot carries Core's largest call input and per-role spend", async () => {
  const byRole = { supervisor: { calls: 1, usd: 0.004 }, builder: { calls: 4, usd: 0.016 } };
  const { written, settle } = await settleBuildOnce(proposedBuild, {}, flowPurse({ build: [5, 0.02] }, { largestInputTokens: 21_000, byRole }));
  await settle();
  const snapshot = written.find(entry => entry.path === "snapshots/live-llm.json")?.value as Record<string, any>;
  assert.equal(snapshot.runSpend.largestInputTokens, 21_000);
  assert.deepEqual(snapshot.runSpend.byRole, { supervisor: { calls: 1, estimatedCostUsd: 0.004 }, builder: { calls: 4, estimatedCostUsd: 0.016 } });
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
// proposal, and live-llm.json said `instructedConsequences: null` although the
// build had read them. Core now publishes the classes on the failure
// diagnostic (t728; `flow-lane/creation/build-proposal.ts` reads them), so the
// step log is no longer read for them.
test("a build that left no proposal carries the consequences Core's diagnostic named, and never reads them from the step log", async (t) => {
  const steps = await mkdtemp(path.join(os.tmpdir(), "fluxiq-live-llm-instructed-"));
  t.after(() => rm(steps, { recursive: true, force: true }));
  await mkdir(path.join(steps, "0015-decide"));
  await writeFile(path.join(steps, "0015-decide", "meta.json"), JSON.stringify({ kind: "decide", provider: DEFAULT_LLM_PROVIDER, costUsd: 0.000379548, part: "creation", phase: "read" }));
  await writeFile(path.join(steps, "0015-decide", "decision.json"), JSON.stringify({ response: { decision: { kind: "complete", result: { instructed: [{ consequence: "delete", quote: "a step log reading" }] } } } }));
  const instructed = [{ consequence: "modify_existing", quote: null }, { consequence: "create_new", quote: null }];
  const stopped: CreatedFlowBuild = { ...proposedBuild, outcome: "failed", adaptationId: null, instructedConsequences: instructed, failure: { code: "flow_bootstrap.evidence_budget_exhausted", stage: null, httpStatus: null } };
  const { run, written, settle } = await settleBuildOnce(stopped);
  run.readStepLogFrom(steps);
  const answered = await settle();
  const snapshot = written.find(entry => entry.path === "snapshots/live-llm.json")?.value as Record<string, any>;
  assert.deepEqual(snapshot.build.instructedConsequences, instructed);
  assert.equal(snapshot.instructedConsequencesFrom, "failure_diagnostic", "Core's build record, here its failure diagnostic");
  // The lane keeps what the settlement answers, so flow-lane.json holds the very record live-llm.json does.
  assert.equal(answered.build, snapshot.build);
  assert.equal(answered.instructedConsequencesFrom, "failure_diagnostic");

  // A build whose record names none stays at none, whatever the step log holds.
  const unread = await settleBuildOnce({ ...stopped, instructedConsequences: null });
  unread.run.readStepLogFrom(steps);
  assert.deepEqual(await unread.settle(), { build: { ...stopped, instructedConsequences: null }, instructedConsequencesFrom: null });

  // A settlement that throws carries the record on the error, so flow-lane.json
  // holds the one live-llm.json was given: a build that reached no provider,
  // and one over its run budget.
  for (const throwing of [
    { ...stopped, providerCalls: 0, providerInvocation: "not_attempted" as const, accounting: null, evidenceLoop: null },
    { ...stopped, accounting: { ...proposedBuild.accounting!, totalTokens: Number.MAX_SAFE_INTEGER } },
  ]) {
    const breached = await settleBuildOnce(throwing);
    const error = await breached.settle().then(() => assert.fail("the settlement must throw"), (thrown: unknown) => thrown);
    assert.ok(error instanceof RunnerFailure);
    const written = breached.written.find(entry => entry.path === "snapshots/live-llm.json")?.value as Record<string, any>;
    assert.deepEqual(written.build.instructedConsequences, instructed);
    assert.equal(settledBuildOf(error)?.build, written.build, "the error carries the very record live-llm.json holds");
    assert.equal(settledBuildOf(error)?.instructedConsequencesFrom, "failure_diagnostic");
  }
});

test("a build that reached no provider fails the run closed, after its evidence is written, and says where Core stopped", async () => {
  const refused: CreatedFlowBuild = { ...proposedBuild, outcome: "failed", adaptationId: null, providerCalls: 0, providerInvocation: "not_attempted", accounting: null, evidenceLoop: null, failure: { code: "flow_bootstrap.provider_resolution_failed", stage: "provider_resolution", httpStatus: 400 } };
  const { written, settle } = await settleBuildOnce(refused);
  await assert.rejects(settle(), (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior"
    && /Live LLM run reached no provider: --live-llm authorized 26 anthropic call\(s\) for --llm-task create-flow and Core made none\. Core's Flow build stopped at provider_resolution before a provider answered\. \(flow_bootstrap\.provider_resolution_failed\)/u.test(error.message));
  assert.ok(written.some(entry => entry.path === "snapshots/live-llm.json"), "the refusal's evidence is written first");
  // A build that outlived its request with nothing to show counts as having called, so it fails on its own code, never as spend-free.
  const unfinished = await settleBuildOnce({ ...refused, providerCalls: null, providerInvocation: "unknown", failure: { code: "lab.generation_unfinished", stage: null, httpStatus: null } }, {}, null);
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
  await assert.rejects(otherModel.settle(), /Core's Flow build ran on anthropic\/deepseek-reasoner, not the authorized anthropic\/claude-sonnet-5-5/u);
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

  core.purse = flowPurse({ build: [5, 0.02], runtime: [3, 0.003] });
  await run.settleRepair(reader(core, { getRunDetail: async () => detail, automationStudioCall: async () => ({ runDetail: { metadata: {} } }) }), { projectId: "project-1", runId: "run-1" }, { writeStructured: async (bundlePath, value) => { written.push({ path: bundlePath, value }); } }, async (details) => { published.push(details); });
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
  // No recovery trace on this run detail: the snapshot then says the exploration and verification records are absent rather than inventing empty ones.
  assert.equal(snapshot.exploration.source, "absent");
  assert.equal(snapshot.exploration.counts.actions, null, "an unexplored run must not read as an exploration that did nothing");
  assert.deepEqual(snapshot.verification, { source: "absent", status: null, basis: null, code: null, verdicts: [], recordedCalls: null, calls: 0, interventions: [], totalEstimatedCostUsd: 0 });
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
  const repair = await run.settleRepair(reader(core, { getRunDetail: async () => repairDetail, automationStudioCall: async () => ({ runDetail: { metadata: {} } }) }), { projectId: "project-1", runId: "run-1" }, { writeStructured: async () => undefined }, async () => undefined)
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
  core.purse = flowPurse({ build: [5, 0.02], runtime: [3, 0.003], judge: [2, 0.00248] });
  const control = reader(core, { getRunDetail: async () => detail, automationStudioCall: async (endpoint: string) => { endpoints.push(endpoint); return verifiedRunDetail; } });
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
  core.purse = flowPurse({ build: [5, 0.02], runtime: [3, 0.003] });
  const control = reader(core, { getRunDetail: async () => detail, automationStudioCall: async (): Promise<unknown> => { throw new Error("gone"); } });
  await run.settleRepair(control, { projectId: "project-1", runId: "run-1" }, { writeStructured: async (bundlePath, value) => { written.push({ path: bundlePath, value }); } }, async () => undefined);
  const snapshot = written.filter(entry => entry.path === "snapshots/live-llm.json").at(-1)?.value as Record<string, any>;
  assert.equal(snapshot.verification.source, "unreadable");
  assert.equal(snapshot.verification.calls, 0);
  assert.equal(snapshot.repair.observed.calls, 3);
});

test("a repair that cannot be read back is recorded, not raised", async () => {
  const { core, run, written, settle } = await settleBuildOnce(proposedBuild);
  await settle();
  await run.repairAuthorizer(core.control, { projectId: "project-1", authorizationPassword: "account-password" })("flow-1");
  const unreadable = reader(core, { getRunDetail: async (): Promise<ExistingRunDetail> => { throw new Error("gone"); }, automationStudioCall: async () => ({ runDetail: { metadata: {} } }) });
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
  core.purse = flowPurse({ build: [5, 0.02], runtime: [27, 0.003] });
  await assert.rejects(
    run.settleRepair(reader(core, { getRunDetail: async () => overspent, automationStudioCall: async () => ({ runDetail: { metadata: {} } }) }), { projectId: "project-1", runId: "run-1" }, { writeStructured: async (bundlePath, value) => { written.push({ path: bundlePath, value }); } }, async () => undefined),
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
 * the run made 60 calls for about $0.0861. Core's Flow purse now holds every
 * one of them by phase, and the Lab reads that figure (t728).
 */
const JUDGE_1 = "llm.loop_verification.ebec2a7a-d161-4541-8176-8172589d34db";
const JUDGE_2 = "llm.loop_verification.6cc3d182-9071-4703-a26e-b025de3b3b8a";
const reauthoredBuild: CreatedFlowBuild = {
  ...proposedBuild,
  providerCalls: 22,
  loopProviderCalls: 21,
  accounting: { provider: DEFAULT_LLM_PROVIDER, model: DEFAULT_LLM_MODEL, inputTokens: 310_347, outputTokens: 5_531, totalTokens: 315_878, estimatedCostUsd: 0.04178802 },
};
/** The playback's parsed detail: no accounting and no per-call lines, so it is read from its interventions, the two checks among them. */
const { llmAccounting: _noAccounting, ...detailWithoutAccounting } = detail;
const reauthoredPlayback: ExistingRunDetail = {
  ...detailWithoutAccounting,
  interventions: [
    { interventionId: "i-judge-1", kind: "diagnosis", requestId: JUDGE_1, provider: DEFAULT_LLM_PROVIDER, model: DEFAULT_LLM_MODEL, validationOk: true, inputTokens: 2_991, outputTokens: 511, totalTokens: 3_502, estimatedCostUsd: 0.001247076 },
    { interventionId: "i-judge-2", kind: "diagnosis", requestId: JUDGE_2, provider: DEFAULT_LLM_PROVIDER, model: DEFAULT_LLM_MODEL, validationOk: true, inputTokens: 2_991, outputTokens: 428, totalTokens: 3_419, estimatedCostUsd: 0.000582996 },
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
const appliedReauthor = { attempt: 1, routed: true, adaptationId: REAUTHOR_ID, applied: true, durationMs: 173_400, accounting: { requestId: "evidence.aa628a38", provider: DEFAULT_LLM_PROVIDER, model: DEFAULT_LLM_MODEL, inputTokens: 441_137, outputTokens: 10_071, totalTokens: 451_208, estimatedCostUsd: 0.042481212 } };
const reauthorAdaptation = () => ({ adaptation: { evidenceLoop: { providerCallCount: 35, additionalProviderCallCount: 1, totalProviderCallCount: 36 } } });

const REAUTHORED_PURSE = flowPurse({ build: [22, 0.04178802], judge: [2, 0.001830072], reauthor: [36, 0.042481212] });

async function settleReauthoredRun(attempts: unknown[], adaptation: () => unknown = reauthorAdaptation, purse: ExistingFlowSpend | null = REAUTHORED_PURSE) {
  const { core, run, written, published, settle } = await settleBuildOnce(reauthoredBuild, { maxCallsPerRun: 48 }, flowPurse({ build: [22, 0.04178802] }));
  await settle();
  await run.repairAuthorizer(core.control, { projectId: "project-1", authorizationPassword: "account-password" })("flow-1");
  core.purse = purse;
  const reads: Array<{ endpoint: string; payload: Record<string, unknown> }> = [];
  const control = {
    getFlowSpend: core.control.getFlowSpend,
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
  // Each phase stays readable on its own, as Core's purse attributed it; the two checks are the judge's.
  assert.deepEqual(snapshot.runSpend.phases, {
    build: { calls: 22, estimatedCostUsd: 0.04178802 },
    read: null,
    judge: { calls: 2, estimatedCostUsd: 0.001830072 },
    runtime: null,
    reauthor: { calls: 36, estimatedCostUsd: 0.042481212 },
    chat: null,
  });
  assert.deepEqual(snapshot.observed.perBuild, {
    ceilingUsd: LAB_CEILING_USD,
    builds: [{ phase: "flow", attempt: null, estimatedCostUsd: 0.086099304, overCeiling: false }],
    parts: [{ phase: "build", attempt: null, estimatedCostUsd: 0.04178802 }, { phase: "judge", attempt: null, estimatedCostUsd: 0.001830072 }, { phase: "reauthor", attempt: null, estimatedCostUsd: 0.042481212 }],
    maxBuildCostUsd: 0.086099304,
    overCeiling: 0,
  });
  assert.deepEqual(snapshot.observed.phases, snapshot.runSpend.phases);
  assert.deepEqual(snapshot.reauthor.attempts, [{ attempt: 1, try: null, adaptationId: REAUTHOR_ID, calls: 36, callsFrom: "adaptation", inputTokens: 441_137, outputTokens: 10_071, estimatedCostUsd: 0.042481212, ending: null }]);
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

test("a re-author attempt's calls are read from Core's record of it, and the run's total is the purse's whatever that record says", async () => {
  const failedRetry = { attempt: 2, routed: true, code: "flow_bootstrap.provider_balance_exhausted", calls: 5, accounting: { inputTokens: 40_000, outputTokens: 900, estimatedCostUsd: 0.004 }, evidenceLoop: { decisionCount: 4 } };
  const purse = flowPurse({ build: [22, 0.04178802], judge: [2, 0.001830072], reauthor: [41, 0.046481212] });
  const counted = await settleReauthoredRun([appliedReauthor, failedRetry], reauthorAdaptation, purse);
  assert.deepEqual(counted.snapshot.reauthor.attempts.map((attempt: { calls: number; callsFrom: string }) => [attempt.calls, attempt.callsFrom]), [[36, "adaptation"], [5, "attempt"]]);
  assert.deepEqual(counted.snapshot.runSpend.phases.reauthor, { calls: 41, estimatedCostUsd: 0.046481212 });
  assert.equal(counted.snapshot.observed.calls, 22 + 2 + 41);
  assert.equal(counted.snapshot.observed.totalEstimatedCostUsd, 0.090099304);
  // The retry's count came from its attempt record, so only the applied attempt was read from an adaptation.
  assert.equal(counted.reads.filter(read => read.endpoint === "get-flow-adaptation").length, 1);

  // An attempt whose calls cannot be read says so on the re-author record; the run's total is still the purse's.
  const unreadable = await settleReauthoredRun([appliedReauthor], () => { throw new Error("gone"); });
  assert.equal(unreadable.snapshot.reauthor.attempts[0].calls, null);
  assert.equal(unreadable.snapshot.reauthor.attempts[0].callsFrom, "adaptation_unreadable");
  assert.equal(unreadable.snapshot.observed.calls, 60);
  assert.deepEqual(unreadable.published.at(-1)?.runTotal, { calls: 60, totalEstimatedCostUsd: 0.086099304 });
});

// Where Core holds no record of the Flow's spend, or one it never itemised, the
// figure it does not have is unknown, never rebuilt from the step log or the
// phase records (`run-muqk713g-d08ad3dc` was the kind of run the rebuild
// existed for: 35 calls in its step log, 17 in Core's records).
test("a run whose Flow Core holds no itemised spend for reports the unknown figures as unknown and says why", async (t) => {
  const steps = await mkdtemp(path.join(os.tmpdir(), "fluxiq-live-run-steps-"));
  t.after(() => rm(steps, { recursive: true, force: true }));
  await mkdir(path.join(steps, "0001-chat"));
  await writeFile(path.join(steps, "0001-chat", "meta.json"), JSON.stringify({ kind: "chat", provider: DEFAULT_LLM_PROVIDER, model: DEFAULT_LLM_MODEL, costUsd: 0.0003 }));

  const none = await settleReauthoredRun([appliedReauthor], reauthorAdaptation, null);
  assert.equal(none.snapshot.runSpend.source, "no_record");
  assert.deepEqual([none.snapshot.observed.calls, none.snapshot.observed.totalEstimatedCostUsd], [null, null]);
  assert.deepEqual(none.snapshot.observed.perBuild, { ceilingUsd: LAB_CEILING_USD, builds: [{ phase: "flow", attempt: null, estimatedCostUsd: null, overCeiling: false }], parts: [], maxBuildCostUsd: null, overCeiling: 0 });
  assert.deepEqual(none.published.at(-1)?.runTotal, { calls: null, totalEstimatedCostUsd: null, spendSource: "no_record" });
  // The evaluation needs a number: the calls Core's own phase records reported, a floor and not a total.
  assert.equal(none.run.usage.calls, 22 + 2, "the build's 22 and the playback detail's 2 priced calls");
  // The playback's recovery keeps the run detail's own figures, since no purse split the checks out.
  assert.equal(none.snapshot.repair.observed.calls, 2);

  const unitemised = await settleReauthoredRun([appliedReauthor], reauthorAdaptation, { ...REAUTHORED_PURSE, calls: null, byPhase: null });
  assert.equal(unitemised.snapshot.runSpend.source, "flow_purse_unitemised");
  assert.deepEqual([unitemised.snapshot.observed.calls, unitemised.snapshot.observed.totalEstimatedCostUsd], [null, 0.086099304]);
  assert.deepEqual(unitemised.snapshot.runSpend.phases, { build: null, read: null, judge: null, runtime: null, reauthor: null, chat: null });
  assert.deepEqual(unitemised.published.at(-1)?.runTotal, { calls: null, totalEstimatedCostUsd: 0.086099304, spendSource: "flow_purse_unitemised" });

  // A read that fails is `unreadable`, and the settlement goes on.
  const { core, run, written, settle } = await settleBuildOnce(proposedBuild);
  run.readStepLogFrom(steps);
  core.control.getFlowSpend = async () => { throw new Error("gone"); };
  await settle();
  const snapshot = written.find(entry => entry.path === "snapshots/live-llm.json")?.value as Record<string, any>;
  assert.equal(snapshot.runSpend.source, "unreadable");
  assert.equal(snapshot.observed.totalEstimatedCostUsd, null, "the step log's chat call is listed, never summed into a total");
  assert.equal(snapshot.observed.observedCalls.length, 1);
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
    { interventionId: "i-recovery", kind: "diagnosis", requestId: "llm.runtime_diagnosis.a", provider: DEFAULT_LLM_PROVIDER, model: DEFAULT_LLM_MODEL, validationOk: true, inputTokens: 900, outputTokens: 100, totalTokens: 1_000, estimatedCostUsd: 0.001 },
    { interventionId: "i-verify-1", kind: "diagnosis", requestId: "llm.loop_verification.b", provider: DEFAULT_LLM_PROVIDER, model: DEFAULT_LLM_MODEL, validationOk: true, inputTokens: 1_944, outputTokens: 300, totalTokens: 2_244, estimatedCostUsd: 0.00125 },
    { interventionId: "i-verify-2", kind: "diagnosis", requestId: "llm.loop_verification.c", provider: DEFAULT_LLM_PROVIDER, model: DEFAULT_LLM_MODEL, validationOk: true, inputTokens: 1_944, outputTokens: 280, totalTokens: 2_224, estimatedCostUsd: 0.00123 },
  ],
};

async function settleChecked(playback: ExistingRunDetail, raw: unknown, purse: ExistingFlowSpend) {
  const { core, run, written, published, settle } = await settleBuildOnce(proposedBuild);
  await settle();
  await run.repairAuthorizer(core.control, { projectId: "project-1", authorizationPassword: "account-password" })("flow-1");
  published.length = 0;
  core.purse = purse;
  await run.settleRepair(reader(core, { getRunDetail: async () => playback, automationStudioCall: async () => raw }), { projectId: "project-1", runId: "run-1" }, { writeStructured: async (bundlePath, value) => { written.push({ path: bundlePath, value }); } }, async (details) => { published.push(details); });
  const snapshot = written.filter(entry => entry.path === "snapshots/live-llm.json").at(-1)?.value as Record<string, any>;
  return { run, snapshot, published };
}

test("a playback's result checks are not its repair: the repair lists recovery only, the checks get their own event, and the spend is unchanged", async () => {
  const { run, snapshot, published } = await settleChecked(checkedPlayback, verifiedRunDetail, flowPurse({ build: [5, 0.02], runtime: [1, 0.001], judge: [2, 0.00248] }));
  assert.equal(snapshot.repair.observed.calls, 1, "only the recovery's call is the repair's");
  assert.equal(snapshot.repair.observed.interventions, 1);
  assert.deepEqual(snapshot.repair.observed.observedCalls.map((call: { requestId: string }) => call.requestId), ["llm.runtime_diagnosis.a"]);
  assert.equal(snapshot.repair.observed.totalEstimatedCostUsd, 0.001);
  assert.deepEqual(snapshot.repair.resultChecks, { calls: 2, totalEstimatedCostUsd: 0.00248, record: "verification" });
  assert.equal(snapshot.verification.calls, 2, "the checks' own record lists them");
  // The whole run, as Core's purse attributed it: build 5 calls $0.02, recovery 1 call $0.001, checks 2 calls $0.00248.
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
  const { snapshot, published } = await settleChecked(onlyChecked, raw, flowPurse({ build: [5, 0.02], judge: [2, 0.00248] }));
  assert.deepEqual({ calls: snapshot.repair.observed.calls, interventions: snapshot.repair.observed.interventions, observedCalls: snapshot.repair.observed.observedCalls, cost: snapshot.repair.observed.totalEstimatedCostUsd }, { calls: 0, interventions: 0, observedCalls: [], cost: 0 });
  assert.equal(snapshot.observed.totalEstimatedCostUsd, 0.02248);
  assert.deepEqual(published, [{ resultChecks: { calls: 2, totalEstimatedCostUsd: 0.00248, status: "unverified" }, runTotal: { calls: 7, totalEstimatedCostUsd: 0.02248 } }]);
});
