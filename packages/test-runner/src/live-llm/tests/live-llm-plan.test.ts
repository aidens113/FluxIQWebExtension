import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LLM_LAB_BUDGET, DEFAULT_LLM_MODEL, LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST, LLM_LAB_MAX_CALLS_PER_RUN, LLM_LAB_MAX_ESTIMATED_COST_USD, LLM_LAB_SCHEMA_VERSION, llmActionConsequences, llmModels, type LlmExecutionProfile, type LlmTaskKind } from "@fluxiq-web-extension/test-contracts";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AUTOMATION_STUDIO_ACTION_CONSEQUENCES, AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_DEFAULT_USD, AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_ENV, AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_MAX_USD, AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_USD, resolveAutomationStudioLlmRunCostCeilingUsd } from "fluxiq/automation-studio";
import { liveLlmBuildCostCeilingUsd } from "../build-cost-ceiling.js";
import type { PersistedFlowLlmExecution } from "../../flow-lane/index.js";
import { planLiveLlmExecution, type LiveLlmPurpose } from "../live-llm-plan.js";
import { LAB_CEILING_USD, planAtLabCeiling } from "./lab-ceiling.js";

/** Core's per-build ceiling as the Lab resolves it (`FLUXIQ_LLM_RUN_COST_CEILING_USD`, default $0.10). */
const CEILING = LAB_CEILING_USD;

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
    const plan = planAtLabCeiling(profile({}, { maxCallsPerRun }));
    assert.equal(plan.purpose, "diagnosis_only");
    assert.equal(plan.maxCalls, 1, `--llm-max-calls ${maxCallsPerRun}`);
    assert.equal(plan.declared.maxCallsPerRun, maxCallsPerRun);
  }
  const plan = planAtLabCeiling(profile());
  assert.equal(plan.provider, "deepseek");
  assert.equal(plan.model, DEFAULT_LLM_MODEL);
});

test("a diagnose profile still needs a cap of at least one, and no more than Core's backstop", () => {
  assert.throws(() => planAtLabCeiling(profile({}, { maxCallsPerRun: 0 })), /--llm-max-calls 0 must be a whole number between 1 and 64/u);
  assert.throws(() => planAtLabCeiling(profile({}, { maxCallsPerRun: 65 })), /--llm-max-calls 65 must be a whole number between 1 and 64/u);
});

test("an adapt profile iterates for the operator's call count, defaulting to Core's twenty-six", () => {
  const byDefault = planAtLabCeiling(profile({ task: "adapt" }));
  assert.equal(byDefault.purpose, "diagnose_and_adapt");
  assert.equal(byDefault.maxCalls, 26);
  assert.equal(byDefault.maxCalls, DEFAULT_LLM_LAB_BUDGET.maxCallsPerRun);

  const ten = planAtLabCeiling(profile({ task: "adapt" }, { maxCallsPerRun: 10 }));
  assert.equal(ten.purpose, "diagnose_and_adapt");
  assert.equal(ten.maxCalls, 10);
});

test("an adapt profile is never refused for asking for more than two calls", () => {
  for (const maxCallsPerRun of [1, 2, 3, 7, 32, 64]) {
    assert.equal(planAtLabCeiling(profile({ task: "adapt" }, { maxCallsPerRun })).maxCalls, maxCallsPerRun, `--llm-max-calls ${maxCallsPerRun}`);
  }
});

test("an adapt call limit above Core's backstop or below one is refused, naming the option", () => {
  assert.throws(() => planAtLabCeiling(profile({ task: "adapt" }, { maxCallsPerRun: 65 })), /Live LLM execution refused: --llm-max-calls 65 must be a whole number between 1 and 64/u);
  assert.throws(() => planAtLabCeiling(profile({ task: "adapt" }, { maxCallsPerRun: 0 })), /--llm-max-calls 0 must be a whole number between 1 and 64/u);
  assert.throws(() => planAtLabCeiling(profile({ task: "adapt" }, { maxCallsPerRun: 2.5 })), /--llm-max-calls 2\.5 must be a whole number/u);
});

test("repair plans the iterating explore_and_adapt intent, and adapt stays the narrow one", () => {
  // Compile-time as much as run-time: the intent must be one the plan names
  // and one the Flow lane will carry to Core.
  const purpose: LiveLlmPurpose = "explore_and_adapt";
  const carried: PersistedFlowLlmExecution = { intent: purpose, permittedConsequences: [] };
  assert.equal(carried.intent, "explore_and_adapt");
  const repair = planAtLabCeiling(profile({ task: "repair" }));
  assert.equal(repair.purpose, "explore_and_adapt");
  assert.equal(repair.task, "repair");
  // It iterates, so the operator's own call count stands, as it does for adapt.
  assert.equal(repair.maxCalls, DEFAULT_LLM_LAB_BUDGET.maxCallsPerRun);
  assert.equal(planAtLabCeiling(profile({ task: "repair" }, { maxCallsPerRun: 40 })).maxCalls, 40);
  assert.throws(() => planAtLabCeiling(profile({ task: "repair" }, { maxCallsPerRun: 65 })), /--llm-max-calls 65 must be a whole number between 1 and 64/u);
  // The narrow intent is unchanged: `repair` is a new task, not a redefinition of `adapt`.
  assert.equal(planAtLabCeiling(profile({ task: "adapt" })).purpose, "diagnose_and_adapt");
});

test("create-flow plans the web panel's iterating build_and_adapt, with the operator's call count and every call's tokens", () => {
  // The whole per-request triple comes from the shared budget. Overriding the
  // output and total limits alone left the input limit at the default, and
  // input plus output may not exceed the total, so the profile was refused.
  const byDefault = planAtLabCeiling(profile({ task: "create-flow" }));
  assert.equal(byDefault.purpose, "build_and_adapt");
  assert.equal(byDefault.task, "create-flow");
  // Core's own iterating default, not a one-call build.
  assert.equal(byDefault.maxCalls, DEFAULT_CALLS);
  // A build's token budget is every authorized call at the per-request limit,
  // so the cost cap and the stall guard bind before tokens do.
  assert.equal(byDefault.maxTotalTokensPerRun, PER_REQUEST * DEFAULT_CALLS);
  assert.equal(planAtLabCeiling(profile({ task: "create-flow" }, { maxCallsPerRun: 40 })).maxCalls, 40);
  // A typed campaign budget once capped real builds at ~34 decisions, so an
  // untyped build budget outlasts every decision ...
  const campaign = planAtLabCeiling(profile({ task: "create-flow" }, { maxCallsPerRun: 48 }));
  assert.equal(campaign.maxTotalTokensPerRun, PER_REQUEST * 48);
  assert.ok(Math.floor(campaign.maxTotalTokensPerRun / 16_000) >= 48, "tokens must outlast every authorized decision");
  // ... but a budget the operator typed is theirs, and binds a build as it binds everything else,
  assert.equal(planAtLabCeiling(profile({ task: "create-flow" }, { maxCallsPerRun: 48, maxTotalTokensPerRun: PER_REQUEST * 2 })).maxTotalTokensPerRun, PER_REQUEST * 2);
  // ... while the operator's cost cap stays exactly theirs,
  const cheap = planAtLabCeiling(profile({ task: "create-flow" }, { maxCallsPerRun: 48, maxEstimatedCostUsd: 0.01 }));
  assert.equal(cheap.maxEstimatedCostUsd, 0.01);
  // and it is the whole build's ceiling, never multiplied by the call count.
  assert.equal(cheap.maxTotalEstimatedCostUsd, 0.01);
  assert.equal(planAtLabCeiling(profile({ task: "create-flow" }, { maxCallsPerRun: 20, maxEstimatedCostUsd: 0.01 })).maxTotalEstimatedCostUsd, 0.01);
  // ... a typed budget is still validated, and every other intent still honours it.
  assert.throws(() => planAtLabCeiling(profile({ task: "create-flow" }, { maxTotalTokensPerRun: PER_REQUEST - 1 })), /--llm-max-run-tokens .* must be a whole number of at least/u);
  assert.equal(planAtLabCeiling(profile({ task: "repair" }, { maxCallsPerRun: 48, maxTotalTokensPerRun: PER_REQUEST * 2 })).maxTotalTokensPerRun, PER_REQUEST * 2);
  // A build intent is never one a Flow run carries: the Flow lane's type has no room for it.
  const runPurposes: ReadonlyArray<PersistedFlowLlmExecution["intent"]> = ["diagnosis_only", "diagnose_and_adapt", "explore_and_adapt"];
  assert.equal((runPurposes as readonly string[]).includes(byDefault.purpose), false);
});

test("without --llm-max-run-tokens the run token budget is every authorized call at the per-request limit", () => {
  // What bounds a run is its spend ceiling, the calls it was allowed and
  // Core's stall guard.
  assert.equal(planAtLabCeiling(profile({ task: "adapt" })).maxTotalTokensPerRun, PER_REQUEST * DEFAULT_CALLS);
  assert.equal(planAtLabCeiling(profile({ task: "adapt" }, { maxCallsPerRun: 3 })).maxTotalTokensPerRun, PER_REQUEST * 3);
  assert.equal(planAtLabCeiling(profile()).maxTotalTokensPerRun, PER_REQUEST);
});

test("a run token budget only moves down: held to what the authorized calls could use, refused below one request", () => {
  assert.equal(planAtLabCeiling(profile({ task: "adapt" }, { maxTotalTokensPerRun: PER_REQUEST * 3 })).maxTotalTokensPerRun, PER_REQUEST * 3);
  const held = planAtLabCeiling(profile({ task: "adapt" }, { maxCallsPerRun: 2, maxTotalTokensPerRun: PER_REQUEST * 5 }));
  assert.equal(held.maxTotalTokensPerRun, PER_REQUEST * 2);
  // A diagnosis makes one call however high the typed budget, so one request is all it can spend.
  const diagnosis = planAtLabCeiling(profile({}, { maxCallsPerRun: 64, maxInputTokens: 40_000, maxOutputTokens: 10_000, maxTotalTokensPerRequest: 50_000, maxTotalTokensPerRun: 3_000_000 }));
  assert.equal(diagnosis.maxTotalTokensPerRun, 50_000);
  // The floor a run budget may never sit below is one whole request, which is
  // now the per-request ceiling itself rather than the 10,000 it once was.
  assert.throws(() => planAtLabCeiling(profile({ task: "adapt" }, { maxTotalTokensPerRun: PER_REQUEST - 1 })), new RegExp(`--llm-max-run-tokens ${PER_REQUEST - 1} must be a whole number of at least --llm-max-total-tokens ${PER_REQUEST}`, "u"));
  assert.throws(() => planAtLabCeiling(profile({ task: "adapt" }, { maxTotalTokensPerRun: PER_REQUEST + 0.5 })), new RegExp(`--llm-max-run-tokens ${PER_REQUEST}\\.5 must be a whole number`, "u"));
});

test("the default 30s timeout is clamped down to Core's 25s ceiling, never up", () => {
  assert.equal(planAtLabCeiling(profile()).timeoutMs, 25_000);
  assert.equal(planAtLabCeiling(profile({}, { timeoutMs: 9_000 })).timeoutMs, 9_000);
});

test("a cost cap of zero cannot authorize a live call", () => {
  assert.throws(() => planAtLabCeiling(profile({}, { maxEstimatedCostUsd: 0 })), /cannot authorize a live provider call/u);
});

test("--llm-max-cost-usd is the whole build's spend ceiling, held to Core's per-build ceiling", () => {
  assert.equal(planAtLabCeiling(profile()).maxTotalEstimatedCostUsd, CEILING);
  assert.equal(planAtLabCeiling(profile({ task: "adapt" })).maxTotalEstimatedCostUsd, CEILING);
  // Below the ceiling, the operator's smaller number is the build's, not one call's.
  assert.equal(planAtLabCeiling(profile({ task: "adapt" }, { maxCallsPerRun: 4, maxEstimatedCostUsd: CEILING / 2 })).maxTotalEstimatedCostUsd, CEILING / 2);
  assert.equal(planAtLabCeiling(profile({ task: "adapt" }, { maxCallsPerRun: 4, maxEstimatedCostUsd: CEILING * 9 })).maxTotalEstimatedCostUsd, CEILING);
});

test("the build's ceiling is Core's resolved value, and the Lab contract's bound is Core's maximum", async (t) => {
  // An empty checkout, so no `.env` file supplies a ceiling.
  const nowhere = await mkdtemp(path.join(os.tmpdir(), "fluxiq-plan-ceiling-"));
  t.after(() => rm(nowhere, { recursive: true, force: true }));
  // Given the environment Core loaded with, the Lab resolves Core's own value.
  assert.equal(liveLlmBuildCostCeilingUsd(nowhere, [], process.env), AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_USD);
  // Through Core's own resolver: its default when nothing is set, the same
  // number for a set value, and the same refusal for an unusable one.
  assert.equal(liveLlmBuildCostCeilingUsd(nowhere, [], {}), AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_DEFAULT_USD);
  assert.equal(liveLlmBuildCostCeilingUsd(nowhere, [], { [AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_ENV]: "0.07" }), resolveAutomationStudioLlmRunCostCeilingUsd({ [AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_ENV]: "0.07" }));
  assert.throws(() => liveLlmBuildCostCeilingUsd(nowhere, ["--llm-cost-ceiling-usd", "abc"], {}), /FLUXIQ_LLM_RUN_COST_CEILING_USD/u);
  // The contract package depends only on Core's public contracts, so it bounds
  // the typed option with a mirror of Core's largest configurable ceiling; a
  // mirror that drifted would let an operator type a number Core could never
  // allow, or refuse one a configured ceiling allows.
  assert.equal(LLM_LAB_MAX_ESTIMATED_COST_USD, AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_MAX_USD);
  // The default declares no lower number, so an unset --llm-max-cost-usd plans the ceiling itself.
  assert.equal(DEFAULT_LLM_LAB_BUDGET.maxEstimatedCostUsd, AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_MAX_USD);
});

test("the plan holds a build to the ceiling it is given, and refuses one that is not an amount", () => {
  assert.equal(planLiveLlmExecution(profile({ task: "adapt" }), 0.07).maxTotalEstimatedCostUsd, 0.07);
  assert.equal(planLiveLlmExecution(profile({ task: "adapt" }, { maxEstimatedCostUsd: 0.03 }), 0.07).maxTotalEstimatedCostUsd, 0.03);
  assert.throws(() => planLiveLlmExecution(profile(), 0), /the per-build cost ceiling 0 is not a positive amount/u);
  assert.throws(() => planLiveLlmExecution(profile(), Number.NaN), /is not a positive amount/u);
});

test("no campaign row can plan more than the per-build ceiling for one build, whatever its calls and cap", () => {
  // The live campaign's own rows: create tasks run 48 calls, repair tasks 26,
  // both at --llm-max-cost-usd 0.25. Every call count the contract allows is
  // tried, with caps at, under and over the ceiling.
  for (const task of ["create-flow", "repair", "adapt", "diagnose"] as const) {
    for (let calls = 1; calls <= LLM_LAB_MAX_CALLS_PER_RUN; calls += 1) {
      for (const cost of [0.001, CEILING / 2, CEILING, CEILING * 1.2, 2]) {
        const plan = planAtLabCeiling(profile({ task }, { maxCallsPerRun: calls, maxEstimatedCostUsd: cost }));
        assert.ok(plan.maxTotalEstimatedCostUsd <= CEILING, `${task} x${calls} at ${cost}`);
        assert.ok(plan.maxEstimatedCostUsd <= plan.maxTotalEstimatedCostUsd, `${task} x${calls} at ${cost}: one call may not outspend its build`);
        assert.equal(plan.maxTotalEstimatedCostUsd, Math.min(cost, CEILING), `${task} x${calls} at ${cost}: never scaled by the call count`);
      }
    }
  }
});

test("a build of 64 calls at Core's ceiling each is allowed Core's ceiling in all, not 64 times the per-call cap", () => {
  // The user's rule: a Flow build's total is Core's ceiling. It used to be $2 here, so
  // `--llm-max-cost-usd 0.25 --llm-max-calls 64` let one build spend eight times that.
  const build = planAtLabCeiling(profile({ task: "create-flow" }, { maxCallsPerRun: 64, maxEstimatedCostUsd: CEILING }));
  assert.equal(build.maxCalls, 64);
  assert.equal(build.maxEstimatedCostUsd, CEILING);
  assert.equal(build.maxTotalEstimatedCostUsd, CEILING);
});

test("the operator's own budget is carried through untouched for the post-run check", () => {
  const plan = planAtLabCeiling(profile({}, { maxEstimatedCostUsd: 0.05, timeoutMs: 30_000 }));
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
    assert.equal(planAtLabCeiling(profile({ model })).model, model);
  }
  const absent = profile();
  delete (absent as { model?: string }).model;
  assert.equal(planAtLabCeiling(absent).model, DEFAULT_LLM_MODEL);
  assert.equal(DEFAULT_LLM_MODEL, "deepseek-flash");
});

test("an unsupported provider, model, task or retry count is refused", () => {
  assert.throws(() => planAtLabCeiling(profile({ provider: "openai" })), /--llm-provider openai is unsupported/u);
  assert.throws(() => planAtLabCeiling(profile({ model: "gpt-4" })), /--llm-model gpt-4 is unsupported; Core is configured for deepseek-flash, deepseek-v4-pro/u);
  // The retired alias is refused by name rather than sent on and answered with
  // an opaque provider 400.
  assert.throws(() => planAtLabCeiling(profile({ model: "deepseek-chat" })), /--llm-model deepseek-chat is unsupported; Core is configured for deepseek-flash, deepseek-v4-pro/u);
  assert.throws(() => planAtLabCeiling(profile({ task: "refine-recording" })), /--llm-task refine-recording has no live runner; use diagnose, adapt, repair or create-flow/u);
  assert.throws(() => planAtLabCeiling(profile({ task: "edit-flow" })), /--llm-task edit-flow has no live runner/u);
  assert.throws(() => planAtLabCeiling(profile({}, { maxRetries: 1 })), /--llm-max-retries 1 is unsupported/u);
});

test("token limits are held inside Core's ceiling and must add up", () => {
  // One token past the per-request ceiling, which is the model's own
  // 1,000,000-token context window. The number comes from the contract rather than being written down,
  // so a plan that stopped agreeing with it fails here instead of passing.
  const overCeiling = LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST + 1;
  assert.throws(() => planAtLabCeiling(profile({}, { maxInputTokens: overCeiling })), new RegExp(`--llm-max-input-tokens ${overCeiling} must be a whole number between 1 and ${LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST}`, "u"));
  assert.throws(() => planAtLabCeiling(profile({}, { maxInputTokens: 9_000, maxOutputTokens: 2_000, maxTotalTokensPerRequest: 10_000 })), /exceeds --llm-max-total-tokens/u);
});

test("a backstop-sized plan's spend ceiling is Core's ceiling, whatever its call count", () => {
  // The ceiling is Core's, saved on the Flow as `maxEstimatedCostUsdPerRun`,
  // which may only lower it.
  assert.equal(planAtLabCeiling(profile({ task: "adapt" }, { maxCallsPerRun: LLM_LAB_MAX_CALLS_PER_RUN })).maxTotalEstimatedCostUsd, CEILING);
});

test("the consequence classes the Lab mirrors are Core's own, in Core's order", () => {
  // The contracts package cannot import Core's runtime, so it keeps a copy;
  // this is what stops the copy drifting. A class Core adds or renames fails
  // here instead of at a live run.
  assert.deepEqual([...llmActionConsequences], [...AUTOMATION_STUDIO_ACTION_CONSEQUENCES]);
});

test("without --llm-permit the plan permits nothing", () => {
  assert.deepEqual(planAtLabCeiling(profile({ task: "create-flow" })).permittedConsequences, []);
  assert.deepEqual(planAtLabCeiling(profile({ task: "repair", permittedConsequences: [] })).permittedConsequences, []);
});

test("--llm-permit is planned as exactly the classes asked for, in Core's order", () => {
  for (const task of ["create-flow", "repair", "adapt"] as const) {
    const planned = planAtLabCeiling(profile({ task, permittedConsequences: ["create_new", "move_money"] }));
    assert.deepEqual(planned.permittedConsequences, ["move_money", "create_new"], task);
  }
});

test("an unknown or repeated class, or a permit on a diagnosis, is refused before any provider call", () => {
  const unknown = ["send_or_publish", "purchase"] as unknown as NonNullable<LlmExecutionProfile["permittedConsequences"]>;
  assert.throws(() => planAtLabCeiling(profile({ task: "create-flow", permittedConsequences: unknown })), /--llm-permit purchase names a consequence class Core does not recognise/u);
  assert.throws(() => planAtLabCeiling(profile({ task: "create-flow", permittedConsequences: ["delete", "delete"] })), /more than once/u);
  assert.throws(() => planAtLabCeiling(profile({ task: "diagnose", permittedConsequences: ["delete"] })), /a diagnose run takes none/u);
});
