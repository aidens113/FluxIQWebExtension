import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LLM_LAB_BUDGET, DEFAULT_LLM_MODEL, LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST, LLM_LAB_MAX_CALLS_PER_RUN, LLM_LAB_SCHEMA_VERSION, llmActionConsequences, llmModels, type LlmExecutionProfile, type LlmTaskKind } from "@fluxiq-web-extension/test-contracts";
import { AUTOMATION_STUDIO_ACTION_CONSEQUENCES } from "fluxiq/automation-studio";
import type { PersistedFlowLlmExecution } from "../../flow-lane/index.js";
import { planLiveLlmExecution, type LiveLlmPurpose } from "../live-llm-plan.js";

/**
 * The plan is where the Lab's budget vocabulary meets Core's, and the only
 * direction it is allowed to move a number is down. These tests pin that: every
 * effective limit is at or inside what the operator typed, and a profile that
 * cannot be run inside its own stated bounds is refused rather than widened.
 *
 * They also pin the call-count model Core now has. An intent that does not
 * iterate makes one call; one that does takes the operator's number, bounded
 * only by Core's runaway backstop. The Lab used to pin adaptation at exactly
 * two calls, which left a real recovery no call to gather evidence with.
 */

function profile(overrides: Partial<LlmExecutionProfile> = {}, budget: Partial<LlmExecutionProfile["budget"]> = {}): LlmExecutionProfile {
  return {
    schemaVersion: LLM_LAB_SCHEMA_VERSION,
    profileId: "lab-diagnose",
    mode: "live",
    provider: "deepseek",
    model: DEFAULT_LLM_MODEL,
    task: "diagnose" as LlmTaskKind,
    scenarioNetworkPolicy: "loopback-only",
    providerEgressPolicy: "core-trusted-provider-only",
    externalSideEffects: false,
    approvalMode: "manual",
    retainRawPrompts: false,
    retainRawResponses: false,
    maxConcurrentRuns: 1,
    ...overrides,
    budget: { ...DEFAULT_LLM_LAB_BUDGET, ...budget },
  };
}

const PER_REQUEST = DEFAULT_LLM_LAB_BUDGET.maxTotalTokensPerRequest;
const DEFAULT_CALLS = DEFAULT_LLM_LAB_BUDGET.maxCallsPerRun;

test("a diagnose profile plans exactly one authorized provider call, whatever cap was typed", () => {
  for (const maxCallsPerRun of [1, 2, DEFAULT_LLM_LAB_BUDGET.maxCallsPerRun, LLM_LAB_MAX_CALLS_PER_RUN]) {
    const plan = planLiveLlmExecution(profile({}, { maxCallsPerRun }));
    assert.equal(plan.purpose, "diagnosis_only");
    assert.equal(plan.maxCalls, 1, `--llm-max-calls ${maxCallsPerRun}`);
    assert.equal(plan.declared.maxCallsPerRun, maxCallsPerRun);
  }
  const plan = planLiveLlmExecution(profile());
  assert.equal(plan.provider, "deepseek");
  assert.equal(plan.model, DEFAULT_LLM_MODEL);
});

test("a diagnose profile still needs a cap of at least one, and no more than Core's backstop", () => {
  assert.throws(() => planLiveLlmExecution(profile({}, { maxCallsPerRun: 0 })), /--llm-max-calls 0 must be a whole number between 1 and 64/u);
  assert.throws(() => planLiveLlmExecution(profile({}, { maxCallsPerRun: 65 })), /--llm-max-calls 65 must be a whole number between 1 and 64/u);
});

test("an adapt profile iterates for the operator's call count, defaulting to Core's twenty-six", () => {
  const byDefault = planLiveLlmExecution(profile({ task: "adapt" }));
  assert.equal(byDefault.purpose, "diagnose_and_adapt");
  assert.equal(byDefault.maxCalls, 26);
  assert.equal(byDefault.maxCalls, DEFAULT_LLM_LAB_BUDGET.maxCallsPerRun);

  const ten = planLiveLlmExecution(profile({ task: "adapt" }, { maxCallsPerRun: 10 }));
  assert.equal(ten.purpose, "diagnose_and_adapt");
  assert.equal(ten.maxCalls, 10);
});

test("an adapt profile is never refused for asking for more than two calls", () => {
  for (const maxCallsPerRun of [1, 2, 3, 7, 32, 64]) {
    assert.equal(planLiveLlmExecution(profile({ task: "adapt" }, { maxCallsPerRun })).maxCalls, maxCallsPerRun, `--llm-max-calls ${maxCallsPerRun}`);
  }
});

test("an adapt call limit above Core's backstop or below one is refused, naming the option", () => {
  assert.throws(() => planLiveLlmExecution(profile({ task: "adapt" }, { maxCallsPerRun: 65 })), /Live LLM execution refused: --llm-max-calls 65 must be a whole number between 1 and 64/u);
  assert.throws(() => planLiveLlmExecution(profile({ task: "adapt" }, { maxCallsPerRun: 0 })), /--llm-max-calls 0 must be a whole number between 1 and 64/u);
  assert.throws(() => planLiveLlmExecution(profile({ task: "adapt" }, { maxCallsPerRun: 2.5 })), /--llm-max-calls 2\.5 must be a whole number/u);
});

test("repair plans the iterating explore_and_adapt intent, and adapt stays the narrow one", () => {
  // Compile-time as much as run-time: the intent must be one the plan names
  // and one the Flow lane will carry to Core.
  const purpose: LiveLlmPurpose = "explore_and_adapt";
  const carried: PersistedFlowLlmExecution = { intent: purpose, permittedConsequences: [] };
  assert.equal(carried.intent, "explore_and_adapt");
  const repair = planLiveLlmExecution(profile({ task: "repair" }));
  assert.equal(repair.purpose, "explore_and_adapt");
  assert.equal(repair.task, "repair");
  // It iterates, so the operator's own call count stands, as it does for adapt.
  assert.equal(repair.maxCalls, DEFAULT_LLM_LAB_BUDGET.maxCallsPerRun);
  assert.equal(planLiveLlmExecution(profile({ task: "repair" }, { maxCallsPerRun: 40 })).maxCalls, 40);
  assert.throws(() => planLiveLlmExecution(profile({ task: "repair" }, { maxCallsPerRun: 65 })), /--llm-max-calls 65 must be a whole number between 1 and 64/u);
  // The narrow intent is unchanged: `repair` is a new task, not a redefinition of `adapt`.
  assert.equal(planLiveLlmExecution(profile({ task: "adapt" })).purpose, "diagnose_and_adapt");
});

test("create-flow plans the web panel's iterating build_and_adapt, with the operator's call count and every call's tokens", () => {
  // The whole per-request triple comes from the shared budget. Overriding the
  // output and total limits alone left the input limit at the default, and
  // input plus output may not exceed the total, so the profile was refused.
  const byDefault = planLiveLlmExecution(profile({ task: "create-flow" }));
  assert.equal(byDefault.purpose, "build_and_adapt");
  assert.equal(byDefault.task, "create-flow");
  // Core's own iterating default, not a one-call build.
  assert.equal(byDefault.maxCalls, DEFAULT_CALLS);
  // A build's token budget is every authorized call at the per-request limit,
  // so the cost cap and the stall guard bind before tokens do.
  assert.equal(byDefault.maxTotalTokensPerRun, PER_REQUEST * DEFAULT_CALLS);
  assert.equal(planLiveLlmExecution(profile({ task: "create-flow" }, { maxCallsPerRun: 40 })).maxCalls, 40);
  // The campaigns' 600,000 at ~16k input tokens a decision capped real builds
  // at ~34 decisions, so an untyped build budget outlasts every decision ...
  const campaign = planLiveLlmExecution(profile({ task: "create-flow" }, { maxCallsPerRun: 48 }));
  assert.equal(campaign.maxTotalTokensPerRun, PER_REQUEST * 48);
  assert.ok(Math.floor(campaign.maxTotalTokensPerRun / 16_000) >= 48, "tokens must outlast every authorized decision");
  // ... but a budget the operator typed is theirs, and binds a build as it binds everything else,
  assert.equal(planLiveLlmExecution(profile({ task: "create-flow" }, { maxCallsPerRun: 48, maxTotalTokensPerRun: 600_000 })).maxTotalTokensPerRun, 600_000);
  // ... while the operator's cost cap stays exactly theirs,
  const cheap = planLiveLlmExecution(profile({ task: "create-flow" }, { maxCallsPerRun: 48, maxEstimatedCostUsd: 0.01 }));
  assert.equal(cheap.maxEstimatedCostUsd, 0.01);
  assert.equal(cheap.maxTotalEstimatedCostUsd, 0.48);
  // ... a typed budget is still validated, and every other intent still honours it.
  assert.throws(() => planLiveLlmExecution(profile({ task: "create-flow" }, { maxTotalTokensPerRun: PER_REQUEST - 1 })), /--llm-max-run-tokens .* must be a whole number of at least/u);
  assert.equal(planLiveLlmExecution(profile({ task: "repair" }, { maxCallsPerRun: 48, maxTotalTokensPerRun: 600_000 })).maxTotalTokensPerRun, 600_000);
  // A build intent is never one a Flow run carries: the Flow lane's type has no room for it.
  const runPurposes: ReadonlyArray<PersistedFlowLlmExecution["intent"]> = ["diagnosis_only", "diagnose_and_adapt", "explore_and_adapt"];
  assert.equal((runPurposes as readonly string[]).includes(byDefault.purpose), false);
});

test("without --llm-max-run-tokens the run token budget is every authorized call at the per-request limit", () => {
  // What bounds a run is its spend ceiling, the calls it was allowed and
  // Core's stall guard.
  assert.equal(planLiveLlmExecution(profile({ task: "adapt" })).maxTotalTokensPerRun, PER_REQUEST * DEFAULT_CALLS);
  assert.equal(planLiveLlmExecution(profile({ task: "adapt" }, { maxCallsPerRun: 3 })).maxTotalTokensPerRun, PER_REQUEST * 3);
  assert.equal(planLiveLlmExecution(profile()).maxTotalTokensPerRun, PER_REQUEST);
});

test("a run token budget only moves down: held to what the authorized calls could use, refused below one request", () => {
  assert.equal(planLiveLlmExecution(profile({ task: "adapt" }, { maxTotalTokensPerRun: 300_000 })).maxTotalTokensPerRun, 300_000);
  const held = planLiveLlmExecution(profile({ task: "adapt" }, { maxCallsPerRun: 2, maxTotalTokensPerRun: 500_000 }));
  assert.equal(held.maxTotalTokensPerRun, PER_REQUEST * 2);
  // A diagnosis makes one call however high the typed budget, so one request is all it can spend.
  const diagnosis = planLiveLlmExecution(profile({}, { maxCallsPerRun: 64, maxInputTokens: 40_000, maxOutputTokens: 10_000, maxTotalTokensPerRequest: 50_000, maxTotalTokensPerRun: 3_000_000 }));
  assert.equal(diagnosis.maxTotalTokensPerRun, 50_000);
  // The floor a run budget may never sit below is one whole request, which is
  // now the per-request ceiling itself rather than the 10,000 it once was.
  assert.throws(() => planLiveLlmExecution(profile({ task: "adapt" }, { maxTotalTokensPerRun: PER_REQUEST - 1 })), new RegExp(`--llm-max-run-tokens ${PER_REQUEST - 1} must be a whole number of at least --llm-max-total-tokens ${PER_REQUEST}`, "u"));
  assert.throws(() => planLiveLlmExecution(profile({ task: "adapt" }, { maxTotalTokensPerRun: PER_REQUEST + 0.5 })), new RegExp(`--llm-max-run-tokens ${PER_REQUEST}\\.5 must be a whole number`, "u"));
});

test("the default 30s timeout is clamped down to Core's 25s ceiling, never up", () => {
  assert.equal(planLiveLlmExecution(profile()).timeoutMs, 25_000);
  assert.equal(planLiveLlmExecution(profile({}, { timeoutMs: 9_000 })).timeoutMs, 9_000);
});

test("a cost cap of zero cannot authorize a live call", () => {
  assert.throws(() => planLiveLlmExecution(profile({}, { maxEstimatedCostUsd: 0 })), /cannot authorize a live provider call/u);
});

test("the run's spend ceiling is the per-call limit across the authorized calls, held to the Lab's $2", () => {
  assert.equal(planLiveLlmExecution(profile()).maxTotalEstimatedCostUsd, 0.25);
  assert.equal(planLiveLlmExecution(profile({ task: "adapt" })).maxTotalEstimatedCostUsd, 2);
  assert.equal(planLiveLlmExecution(profile({ task: "adapt" }, { maxCallsPerRun: 4, maxEstimatedCostUsd: 0.05 })).maxTotalEstimatedCostUsd, 0.2);
  assert.equal(planLiveLlmExecution(profile({ task: "adapt" }, { maxCallsPerRun: 4, maxEstimatedCostUsd: 0.9 })).maxTotalEstimatedCostUsd, 1);
});

test("the operator's own budget is carried through untouched for the post-run check", () => {
  const plan = planLiveLlmExecution(profile({}, { maxEstimatedCostUsd: 0.05, timeoutMs: 30_000 }));
  assert.equal(plan.declared.maxEstimatedCostUsd, 0.05);
  assert.equal(plan.declared.timeoutMs, 30_000);
  assert.equal(plan.maxEstimatedCostUsd, 0.05);
});

test("every configured model reaches the plan, and the default is what an absent one means", () => {
  // The plan used to permit exactly `deepseek-chat`, so when DeepSeek retired
  // that alias no `--llm-model` could be run: the only fix was a source edit
  // here and in Core at the same moment. The model is a setting now, and these
  // pin that it is the operator's choice that travels, not a constant.
  for (const model of llmModels) {
    assert.equal(planLiveLlmExecution(profile({ model })).model, model);
  }
  const absent = profile();
  delete (absent as { model?: string }).model;
  assert.equal(planLiveLlmExecution(absent).model, DEFAULT_LLM_MODEL);
  assert.equal(DEFAULT_LLM_MODEL, "deepseek-flash");
});

test("an unsupported provider, model, task or retry count is refused", () => {
  assert.throws(() => planLiveLlmExecution(profile({ provider: "openai" })), /--llm-provider openai is unsupported/u);
  assert.throws(() => planLiveLlmExecution(profile({ model: "gpt-4" })), /--llm-model gpt-4 is unsupported; Core is configured for deepseek-flash, deepseek-v4-pro/u);
  // The retired alias is refused by name rather than sent on and answered with
  // an opaque provider 400.
  assert.throws(() => planLiveLlmExecution(profile({ model: "deepseek-chat" })), /--llm-model deepseek-chat is unsupported; Core is configured for deepseek-flash, deepseek-v4-pro/u);
  assert.throws(() => planLiveLlmExecution(profile({ task: "refine-recording" })), /--llm-task refine-recording has no live runner; use diagnose, adapt, repair or create-flow/u);
  assert.throws(() => planLiveLlmExecution(profile({ task: "edit-flow" })), /--llm-task edit-flow has no live runner/u);
  assert.throws(() => planLiveLlmExecution(profile({}, { maxRetries: 1 })), /--llm-max-retries 1 is unsupported/u);
});

test("token limits are held inside Core's ceiling and must add up", () => {
  // One token past Core's own per-request ceiling, which is 64k
  // context. The number comes from the contract rather than being written down,
  // so a plan that stopped agreeing with it fails here instead of passing.
  const overCeiling = LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST + 1;
  assert.throws(() => planLiveLlmExecution(profile({}, { maxInputTokens: overCeiling })), new RegExp(`--llm-max-input-tokens ${overCeiling} must be a whole number between 1 and ${LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST}`, "u"));
  assert.throws(() => planLiveLlmExecution(profile({}, { maxInputTokens: 9_000, maxOutputTokens: 2_000, maxTotalTokensPerRequest: 10_000 })), /exceeds --llm-max-total-tokens/u);
});

test("a backstop-sized plan's spend ceiling is the Lab's $2, whatever its call count", () => {
  // The ceiling is the Lab's own choice, saved on the Flow as
  // `maxEstimatedCostUsdPerRun`.
  assert.equal(planLiveLlmExecution(profile({ task: "adapt" }, { maxCallsPerRun: LLM_LAB_MAX_CALLS_PER_RUN })).maxTotalEstimatedCostUsd, 2);
});

test("the consequence classes the Lab mirrors are Core's own, in Core's order", () => {
  // The contracts package cannot import Core's runtime, so it keeps a copy;
  // this is what stops the copy drifting. A class Core adds or renames fails
  // here instead of at a live run.
  assert.deepEqual([...llmActionConsequences], [...AUTOMATION_STUDIO_ACTION_CONSEQUENCES]);
});

test("without --llm-permit the plan permits nothing", () => {
  assert.deepEqual(planLiveLlmExecution(profile({ task: "create-flow" })).permittedConsequences, []);
  assert.deepEqual(planLiveLlmExecution(profile({ task: "repair", permittedConsequences: [] })).permittedConsequences, []);
});

test("--llm-permit is planned as exactly the classes asked for, in Core's order", () => {
  for (const task of ["create-flow", "repair", "adapt"] as const) {
    const planned = planLiveLlmExecution(profile({ task, permittedConsequences: ["create_new", "move_money"] }));
    assert.deepEqual(planned.permittedConsequences, ["move_money", "create_new"], task);
  }
});

test("an unknown or repeated class, or a permit on a diagnosis, is refused before any provider call", () => {
  const unknown = ["send_or_publish", "purchase"] as unknown as NonNullable<LlmExecutionProfile["permittedConsequences"]>;
  assert.throws(() => planLiveLlmExecution(profile({ task: "create-flow", permittedConsequences: unknown })), /--llm-permit purchase names a consequence class Core does not recognise/u);
  assert.throws(() => planLiveLlmExecution(profile({ task: "create-flow", permittedConsequences: ["delete", "delete"] })), /more than once/u);
  assert.throws(() => planLiveLlmExecution(profile({ task: "diagnose", permittedConsequences: ["delete"] })), /a diagnose run takes none/u);
});
