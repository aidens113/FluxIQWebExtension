import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LLM_LAB_BUDGET, DEFAULT_LLM_MODEL, DEFAULT_LLM_PROVIDER, LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST, LLM_LAB_MAX_ESTIMATED_COST_USD, LLM_LAB_SCHEMA_VERSION, llmActionConsequences, llmModels, llmProviderForModel, type LlmExecutionProfile, type LlmTaskKind } from "@fluxiq-web-extension/test-contracts";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AUTOMATION_STUDIO_ACTION_CONSEQUENCES, AUTOMATION_STUDIO_LLM_TEST_RUN_COST_CEILING_DEFAULT_USD, AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_SCOPE_ENV, AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_ENV, AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_MAX_USD, resolveAutomationStudioLlmRunCostCeilingUsd } from "fluxiq/automation";
import { liveLlmBuildCostCeilingUsd } from "../build-cost-ceiling.js";
import type { PersistedFlowLlmExecution } from "../../flow-lane/index.js";
import { assertLiveLlmLaunchable, planLiveLlmExecution, type LiveLlmPurpose } from "../live-llm-plan.js";
import { RunnerFailure } from "../../failure.js";
import { AUTOMATION_STUDIO_ANTHROPIC_DEFAULT_MODEL, AUTOMATION_STUDIO_ANTHROPIC_MODELS, AUTOMATION_STUDIO_ANTHROPIC_MODEL_LIMITS } from "fluxiq/automation/llm-models";
import { LAB_CEILING_USD, planAtLabCeiling } from "./lab-ceiling.js";

/** Core's per-build ceiling as the Lab resolves it (`FLUXIQ_LLM_RUN_COST_CEILING_USD`, default $0.10). */
const CEILING = LAB_CEILING_USD;

/**
 * The plan is where the Lab's budget vocabulary meets Core's, and the only
 * direction it is allowed to move a number is down. These tests pin that: every
 * effective limit is at or inside what the operator typed, and a profile that
 * cannot be run inside its own stated bounds is refused rather than widened.
 *
 * They also pin that no count of calls exists: the plan carries none, and the
 * purse (`--llm-max-cost-usd`) bounds a run (t1056, t1064).
 */

function profile(overrides: Partial<LlmExecutionProfile> = {}, budget: Partial<LlmExecutionProfile["budget"]> = {}): LlmExecutionProfile {
  return {
    schemaVersion: LLM_LAB_SCHEMA_VERSION,
    profileId: "lab-diagnose",
    mode: "live",
    provider: DEFAULT_LLM_PROVIDER,
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

test("a plan carries no call count, whatever the task", () => {
  for (const task of ["diagnose", "adapt", "repair", "create-flow"] as const) {
    const plan = planAtLabCeiling(profile({ task }));
    assert.equal("maxCalls" in plan, false, task);
    assert.equal("maxCallsPerRun" in plan.declared, false, task);
  }
  const plan = planAtLabCeiling(profile());
  assert.equal(plan.purpose, "diagnosis_only");
  assert.equal(plan.provider, DEFAULT_LLM_PROVIDER);
  assert.equal(plan.model, DEFAULT_LLM_MODEL);
  assert.equal(planAtLabCeiling(profile({ task: "adapt" })).purpose, "diagnose_and_adapt");
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
  // The narrow intent is unchanged: `repair` is a new task, not a redefinition of `adapt`.
  assert.equal(planAtLabCeiling(profile({ task: "adapt" })).purpose, "diagnose_and_adapt");
});

test("create-flow plans the web panel's iterating build_and_adapt, with every call's tokens and no call count", () => {
  // The whole per-request triple comes from the shared budget. Overriding the
  // output and total limits alone left the input limit at the default, and
  // input plus output may not exceed the total, so the profile was refused.
  const byDefault = planAtLabCeiling(profile({ task: "create-flow" }));
  assert.equal(byDefault.purpose, "build_and_adapt");
  assert.equal(byDefault.task, "create-flow");
  // No run token budget unless one was typed: the cost cap and the stall guard bind.
  assert.equal(byDefault.maxTotalTokensPerRun, undefined);
  assert.equal("maxTotalTokensPerRun" in byDefault, false);
  // A budget the operator typed is theirs, and binds a build as it binds everything else,
  assert.equal(planAtLabCeiling(profile({ task: "create-flow" }, { maxTotalTokensPerRun: PER_REQUEST * 2 })).maxTotalTokensPerRun, PER_REQUEST * 2);
  // ... while the operator's cost cap stays exactly theirs,
  const cheap = planAtLabCeiling(profile({ task: "create-flow" }, { maxEstimatedCostUsd: 0.01 }));
  assert.equal(cheap.maxEstimatedCostUsd, 0.01);
  // and it is the whole build's ceiling.
  assert.equal(cheap.maxTotalEstimatedCostUsd, 0.01);
  // ... a typed budget is still validated, and every other intent still honours it.
  assert.throws(() => planAtLabCeiling(profile({ task: "create-flow" }, { maxTotalTokensPerRun: PER_REQUEST - 1 })), /--llm-max-run-tokens .* must be a whole number of at least/u);
  assert.equal(planAtLabCeiling(profile({ task: "repair" }, { maxTotalTokensPerRun: PER_REQUEST * 2 })).maxTotalTokensPerRun, PER_REQUEST * 2);
  // A build intent is never one a Flow run carries: the Flow lane's type has no room for it.
  const runPurposes: ReadonlyArray<PersistedFlowLlmExecution["intent"]> = ["diagnosis_only", "diagnose_and_adapt", "explore_and_adapt"];
  assert.equal((runPurposes as readonly string[]).includes(byDefault.purpose), false);
});

test("without --llm-max-run-tokens the plan holds no run token budget", () => {
  // What bounds a run is its spend ceiling and Core's stall guard.
  for (const task of ["adapt", "diagnose", "repair", "create-flow"] as const) assert.equal(planAtLabCeiling(profile({ task })).maxTotalTokensPerRun, undefined, task);
});

test("a typed run token budget is carried as typed and refused below one request", () => {
  assert.equal(planAtLabCeiling(profile({ task: "adapt" }, { maxTotalTokensPerRun: PER_REQUEST * 3 })).maxTotalTokensPerRun, PER_REQUEST * 3);
  assert.equal(planAtLabCeiling(profile({ task: "adapt" }, { maxTotalTokensPerRun: PER_REQUEST * 5 })).maxTotalTokensPerRun, PER_REQUEST * 5);
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
  assert.equal(planAtLabCeiling(profile({ task: "adapt" }, { maxEstimatedCostUsd: CEILING / 2 })).maxTotalEstimatedCostUsd, CEILING / 2);
  assert.equal(planAtLabCeiling(profile({ task: "adapt" }, { maxEstimatedCostUsd: CEILING * 9 })).maxTotalEstimatedCostUsd, CEILING);
});

test("the build's ceiling is Core's resolved value, and the Lab contract's bound is Core's maximum", async (t) => {
  // An empty checkout, so no `.env` file supplies a ceiling.
  const nowhere = await mkdtemp(path.join(os.tmpdir(), "fluxiq-plan-ceiling-"));
  t.after(() => rm(nowhere, { recursive: true, force: true }));
  // Given the environment Core loaded with, the Lab resolves Core's own value.
  assert.equal(liveLlmBuildCostCeilingUsd(nowhere, [], process.env), resolveAutomationStudioLlmRunCostCeilingUsd({ ...process.env, [AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_SCOPE_ENV]: "test" }));
  // Through Core's own resolver: its default when nothing is set, the same
  // number for a set value, and the same refusal for an unusable one.
  assert.equal(liveLlmBuildCostCeilingUsd(nowhere, [], {}), AUTOMATION_STUDIO_LLM_TEST_RUN_COST_CEILING_DEFAULT_USD);
  assert.equal(liveLlmBuildCostCeilingUsd(nowhere, [], { [AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_ENV]: "0.07" }), resolveAutomationStudioLlmRunCostCeilingUsd({ [AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_SCOPE_ENV]: "test", [AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_ENV]: "0.07" }));
  assert.throws(() => liveLlmBuildCostCeilingUsd(nowhere, ["--llm-cost-ceiling-usd", "abc"], {}), /FLUXIQ_LLM_RUN_COST_CEILING_USD/u);
  // The contract package depends only on Core's public contracts, so it bounds
  // the typed option with a mirror of Core's largest configurable ceiling; a
  // mirror that drifted would let an operator type a number Core could never
  // allow, or refuse one a configured ceiling allows.
  assert.equal(LLM_LAB_MAX_ESTIMATED_COST_USD, AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_MAX_USD);
  // An unset --llm-max-cost-usd declares this: a lower Core ceiling holds the build lower, and a higher one does not raise it.
  assert.equal(DEFAULT_LLM_LAB_BUDGET.maxEstimatedCostUsd, 5);
});

test("the plan holds a build to the ceiling it is given, and refuses one that is not an amount", () => {
  assert.equal(planLiveLlmExecution(profile({ task: "adapt" }), 0.07).maxTotalEstimatedCostUsd, 0.07);
  assert.equal(planLiveLlmExecution(profile({ task: "adapt" }, { maxEstimatedCostUsd: 0.03 }), 0.07).maxTotalEstimatedCostUsd, 0.03);
  assert.throws(() => planLiveLlmExecution(profile(), 0), /the per-build cost ceiling 0 is not a positive amount/u);
  assert.throws(() => planLiveLlmExecution(profile(), Number.NaN), /is not a positive amount/u);
});

test("no plan can hold more than the per-build ceiling for one build, whatever its cap", () => {
  for (const task of ["create-flow", "repair", "adapt", "diagnose"] as const) {
    for (const cost of [0.001, CEILING / 2, CEILING, CEILING * 1.2, 2]) {
      const plan = planAtLabCeiling(profile({ task }, { maxEstimatedCostUsd: cost }));
      assert.ok(plan.maxTotalEstimatedCostUsd <= CEILING, `${task} at ${cost}`);
      assert.ok(plan.maxEstimatedCostUsd <= plan.maxTotalEstimatedCostUsd, `${task} at ${cost}: one call may not outspend its build`);
      assert.equal(plan.maxTotalEstimatedCostUsd, Math.min(cost, CEILING), `${task} at ${cost}`);
    }
  }
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
    assert.equal(planAtLabCeiling(profile({ model, provider: llmProviderForModel(model) })).model, model);
  }
  const absent = profile();
  delete (absent as { model?: string }).model;
  assert.equal(planAtLabCeiling(absent).model, DEFAULT_LLM_MODEL);
  assert.equal(DEFAULT_LLM_MODEL, "claude-haiku-5-5");
});

test("Claude's Lab catalog and context ceiling match Core's public model seam", () => {
  assert.equal(AUTOMATION_STUDIO_ANTHROPIC_DEFAULT_MODEL, DEFAULT_LLM_MODEL);
  assert.deepEqual([...AUTOMATION_STUDIO_ANTHROPIC_MODELS].sort(), llmModels.filter(model => model.startsWith("claude-")).sort());
  for (const model of AUTOMATION_STUDIO_ANTHROPIC_MODELS) {
    assert.equal(AUTOMATION_STUDIO_ANTHROPIC_MODEL_LIMITS[model].contextTokens, LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST);
    assert.equal(AUTOMATION_STUDIO_ANTHROPIC_MODEL_LIMITS[model].maxOutputTokens, 128_000);
  }
});

test("an unsupported provider, model, task or retry count is refused", () => {
  assert.throws(() => planAtLabCeiling(profile({ provider: "openai" })), /--llm-provider openai is unsupported/u);
  assert.throws(() => planAtLabCeiling(profile({ model: "gpt-4" })), /--llm-model gpt-4 is unsupported; Core is configured for/u);
  // The retired alias is refused by name rather than sent on and answered with
  // an opaque provider 400.
  assert.throws(() => planAtLabCeiling(profile({ model: "deepseek-chat" })), /--llm-model deepseek-chat is unsupported; Core is configured for/u);
  assert.throws(() => planAtLabCeiling(profile({ provider: "deepseek", model: "claude-sonnet-5-5" })), /does not belong/u);
  assert.throws(() => planAtLabCeiling(profile({ task: "refine-recording" })), /--llm-task refine-recording has no live runner; a live Lab run builds with create-flow/u);
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

// `diagnose`, `adapt` and `repair` ran only on the recording-built Flow lane
// t519 retired. Each is refused by name, as that lane's own refusal is, with the
// instruction-led command that replaced it; `create-flow` passes. The lane
// itself, bare `--flow` and the live matrix, is refused while the command is
// parsed (`tests/commands.test.ts`).
test("diagnose, adapt and repair are refused with the instruction-led path; create-flow launches", () => {
  for (const task of ["diagnose", "adapt", "repair"] as const) {
    assert.throws(() => assertLiveLlmLaunchable({ task }), (error: unknown) => {
      assert.ok(error instanceof RunnerFailure);
      assert.equal(error.category, "recording.contract");
      assert.deepEqual(error.details, { code: "automation.instruction_led_authoring_required", retiredTask: task });
      assert.match(error.message, new RegExp(`^--llm-task ${task} ran against a Flow built from the run's recording`, "u"));
      // The supported path, and never the retired `--flow` it used to ask for.
      assert.match(error.message, /pnpm lab run <scenario> --live-llm .*--llm-task create-flow --instruction-task <task> --target persistent-isolated --workspace <name> --replays 1/u);
      assert.match(error.message, /pnpm lab replay <scenario> --workspace <name> --project <project-id> --flow <flow-id> --instruction-task <task>/u);
      assert.doesNotMatch(error.message, /pass --flow|drop --flow/u);
      return true;
    }, task);
  }
  assert.doesNotThrow(() => assertLiveLlmLaunchable({ task: "create-flow" }));
});
