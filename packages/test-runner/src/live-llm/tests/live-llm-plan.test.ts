import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DEFAULT_LLM_LAB_BUDGET, DEFAULT_LLM_MODEL, LLM_ABSOLUTE_MAX_TOTAL_TOKENS_PER_REQUEST, LLM_LAB_MAX_CALLS_PER_RUN, LLM_LAB_SCHEMA_VERSION, llmActionConsequences, llmModels, type LlmExecutionProfile, type LlmTaskKind } from "@fluxiq-web-extension/test-contracts";
import {
  AUTOMATION_STUDIO_ACTION_CONSEQUENCES,
  AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_DEFAULT_MAX_CALLS,
  AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_CALLS,
  AUTOMATION_STUDIO_LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD,
} from "fluxiq/automation-studio";
import type { PersistedFlowLlmExecution } from "../../flow-lane/index.js";
import { planLiveLlmExecution, type LiveLlmPurpose } from "../live-llm-plan.js";

/**
 * The plan is where the Lab's budget vocabulary meets Core's, and the only
 * direction it is allowed to move a number is down. These tests pin that: every
 * effective limit is at or inside what the operator typed, and a profile that
 * cannot be run inside its own stated bounds is refused rather than widened.
 *
 * They also pin the call-count model Core now has. A purpose that does not
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

/**
 * Core's own numbers, imported rather than copied. This file used to carry the
 * confirmation threshold as the literal 100_000, in step with a Lab plan that
 * carried the same literal -- so the two agreed with each other and with
 * nothing else. Core had moved to ten *full* requests, and because the plan's
 * number is sent on every grant request, the stale copy overrode Core rather
 * than merely lagging it. Nothing below writes a token count down.
 */
const CORE_THRESHOLD = AUTOMATION_STUDIO_LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD;
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

test("repair plans the iterating explore_and_adapt grant, and adapt stays the narrow one", () => {
  // Compile-time as much as run-time: the purpose must be one the plan names
  // and one the Flow lane will carry to Core.
  const purpose: LiveLlmPurpose = "explore_and_adapt";
  const carried: PersistedFlowLlmExecution = { grantId: "llm-grant:test", purpose };
  assert.equal(carried.purpose, "explore_and_adapt");
  const repair = planLiveLlmExecution(profile({ task: "repair" }));
  assert.equal(repair.purpose, "explore_and_adapt");
  assert.equal(repair.task, "repair");
  // It iterates, so the operator's own call count stands, as it does for adapt.
  assert.equal(repair.maxCalls, DEFAULT_LLM_LAB_BUDGET.maxCallsPerRun);
  assert.equal(planLiveLlmExecution(profile({ task: "repair" }, { maxCallsPerRun: 40 })).maxCalls, 40);
  assert.throws(() => planLiveLlmExecution(profile({ task: "repair" }, { maxCallsPerRun: 65 })), /--llm-max-calls 65 must be a whole number between 1 and 64/u);
  // The narrow grant is unchanged: `repair` is a new task, not a redefinition of `adapt`.
  assert.equal(planLiveLlmExecution(profile({ task: "adapt" })).purpose, "diagnose_and_adapt");
});

test("create-flow plans the web panel's iterating build_and_adapt grant, with the operator's call count and Core's default run budget", () => {
  // The whole per-request triple comes from the shared budget. Overriding the
  // output and total limits alone left the input limit at the default, and
  // input plus output may not exceed the total, so the profile was refused.
  const byDefault = planLiveLlmExecution(profile({ task: "create-flow" }));
  assert.equal(byDefault.purpose, "build_and_adapt");
  assert.equal(byDefault.task, "create-flow");
  // Core's own iterating default, not a one-call build.
  assert.equal(byDefault.maxCalls, DEFAULT_CALLS);
  // Twenty-six full requests is far past Core's threshold, so the default run
  // budget is the threshold itself.
  assert.equal(byDefault.maxTotalTokensPerRun, CORE_THRESHOLD);
  assert.equal(byDefault.highTokenConfirmation.required, false);
  assert.equal(planLiveLlmExecution(profile({ task: "create-flow" }, { maxCallsPerRun: 40 })).maxCalls, 40);
  // A build grant is never one a Flow run carries: the Flow lane's type has no room for it.
  const runPurposes: ReadonlyArray<PersistedFlowLlmExecution["purpose"]> = ["diagnosis_only", "diagnose_and_adapt", "explore_and_adapt"];
  assert.equal((runPurposes as readonly string[]).includes(byDefault.purpose), false);
});

test("without --llm-max-run-tokens the run token budget is Core's default, so a default adapt run needs no confirmation", () => {
  // Twenty-six calls at the per-request ceiling could use twenty-six times it;
  // Core's default budget holds the run down to its confirmation threshold,
  // which is ten full requests.
  const byDefault = planLiveLlmExecution(profile({ task: "adapt" }));
  const exposure = PER_REQUEST * DEFAULT_CALLS;
  assert.equal(byDefault.maxTotalTokensPerRun, CORE_THRESHOLD);
  assert.deepEqual(
    { required: byDefault.highTokenConfirmation.required, authorizedTokens: byDefault.highTokenConfirmation.authorizedTokens, threshold: byDefault.highTokenConfirmation.threshold },
    { required: false, authorizedTokens: CORE_THRESHOLD, threshold: CORE_THRESHOLD },
  );
  assert.match(byDefault.highTokenConfirmation.reason, new RegExp(`budget of ${CORE_THRESHOLD} \\(Core's default: the smaller of --llm-max-total-tokens ${PER_REQUEST} x ${DEFAULT_CALLS} authorized call\\(s\\) = ${exposure} and ${CORE_THRESHOLD}\\) is within Core's ${CORE_THRESHOLD}-token confirmation threshold`, "u"));
  // Fewer calls than the threshold covers: the budget is what those calls could use.
  assert.equal(planLiveLlmExecution(profile({ task: "adapt" }, { maxCallsPerRun: 3 })).maxTotalTokensPerRun, PER_REQUEST * 3);
  assert.equal(planLiveLlmExecution(profile()).maxTotalTokensPerRun, PER_REQUEST);
});

test("Core's high-token confirmation is planned exactly when the run token budget exceeds its threshold", () => {
  const atThreshold = planLiveLlmExecution(profile({ task: "adapt" }, { maxTotalTokensPerRun: CORE_THRESHOLD }));
  assert.equal(atThreshold.maxTotalTokensPerRun, CORE_THRESHOLD);
  assert.equal(atThreshold.highTokenConfirmation.required, false);
  assert.match(atThreshold.highTokenConfirmation.reason, new RegExp(`budget of ${CORE_THRESHOLD} \\(--llm-max-run-tokens ${CORE_THRESHOLD}\\) is within`, "u"));

  const above = planLiveLlmExecution(profile({ task: "adapt" }, { maxTotalTokensPerRun: CORE_THRESHOLD + 1 }));
  assert.equal(above.maxTotalTokensPerRun, CORE_THRESHOLD + 1);
  assert.equal(above.highTokenConfirmation.required, true);
  assert.equal(above.highTokenConfirmation.authorizedTokens, CORE_THRESHOLD + 1);
  assert.match(above.highTokenConfirmation.reason, new RegExp(`budget of ${CORE_THRESHOLD + 1} \\(--llm-max-run-tokens ${CORE_THRESHOLD + 1}\\) is above Core's ${CORE_THRESHOLD}-token confirmation threshold; the explicit --live-llm budget is the operator's confirmation`, "u"));

  // Calls alone never trigger it: even Core's backstop of calls, at the default
  // per-request budget, is held to the threshold and so needs no confirmation.
  assert.equal(planLiveLlmExecution(profile({ task: "adapt" }, { maxCallsPerRun: LLM_LAB_MAX_CALLS_PER_RUN })).highTokenConfirmation.required, false);
});

test("a run token budget only moves down: held to what the authorized calls could use, refused below one request", () => {
  const held = planLiveLlmExecution(profile({ task: "adapt" }, { maxCallsPerRun: 2, maxTotalTokensPerRun: 500_000 }));
  assert.equal(held.maxTotalTokensPerRun, PER_REQUEST * 2);
  assert.equal(held.highTokenConfirmation.required, false);
  assert.match(held.highTokenConfirmation.reason, new RegExp(`--llm-max-run-tokens 500000, held to --llm-max-total-tokens ${PER_REQUEST} x 2 authorized call\\(s\\) = ${PER_REQUEST * 2}`, "u"));
  // A diagnosis makes one call however high the typed budget, so one request is all it can spend.
  const diagnosis = planLiveLlmExecution(profile({}, { maxCallsPerRun: 64, maxInputTokens: 40_000, maxOutputTokens: 10_000, maxTotalTokensPerRequest: 50_000, maxTotalTokensPerRun: 3_000_000 }));
  assert.equal(diagnosis.maxTotalTokensPerRun, 50_000);
  assert.equal(diagnosis.highTokenConfirmation.required, false);
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

test("the run's total cost limit is the per-call limit across the authorized calls, held to Core's $2", () => {
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

test("the call, token and cost numbers the Lab mirrors are Core's own", async () => {
  // This is the drift detector, and it did its job: it caught the Lab
  // overriding Core's confirmation threshold with a stale 100_000. But it did
  // so by parsing Core's source for a plain number, and that stopped working
  // the moment Core derived the threshold from its per-call limit instead of
  // writing it down -- the check then failed with "no longer a plain numeric
  // constant" rather than with the difference it had actually found.
  //
  // So everything Core exports is imported here instead. An import cannot be
  // defeated by a change of expression, and cannot drift.
  assert.equal(AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_MAX_CALLS, LLM_LAB_MAX_CALLS_PER_RUN);
  assert.equal(AUTOMATION_STUDIO_LLM_EXECUTION_GRANT_DEFAULT_MAX_CALLS, DEFAULT_LLM_LAB_BUDGET.maxCallsPerRun);
  assert.equal(AUTOMATION_STUDIO_LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD, planLiveLlmExecution(profile()).highTokenConfirmation.threshold);
  // Core's ceiling on a grant's total cost, which a backstop-sized plan reaches,
  // is the one number here Core does not export -- so it is still read from
  // Core's source, where it is still a plain numeric constant. Reading the
  // source rather than the build is deliberate: the build can lag it, and a Lab
  // run against a Core build older than Core's source is refused outright
  // (`scripts/lab/core-build-stale.mjs`).
  const source = await readFile(new URL("../../../src/programs/automation-studio/runtime/llm/execution-grants.ts", import.meta.resolve("fluxiq/automation-studio")), "utf8");
  const totalCost = /^const MAX_TOTAL_COST_USD = ([0-9_.]+);/mu.exec(source);
  assert.ok(totalCost?.[1], "MAX_TOTAL_COST_USD is no longer a plain numeric constant in Core's execution-grants.ts");
  assert.equal(Number(totalCost[1].replaceAll("_", "")), planLiveLlmExecution(profile({ task: "adapt" }, { maxCallsPerRun: LLM_LAB_MAX_CALLS_PER_RUN })).maxTotalEstimatedCostUsd);
});

test("the consequence classes the Lab mirrors are Core's own, in Core's order", () => {
  // The contracts package cannot import Core's runtime, so it keeps a copy;
  // this is what stops the copy drifting. A class Core adds or renames fails
  // here instead of at a live grant.
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
