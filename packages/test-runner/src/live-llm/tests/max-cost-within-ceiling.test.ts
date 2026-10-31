// `--llm-max-cost-usd` above the per-build ceiling the run's Core resolves is
// refused before anything starts. It used to be clamped silently: on
// 2026-10-18 twelve launches typed a number above Core's ceiling, the Lab held
// every build to the lower one, and two builds stopped on the ceiling they had
// not asked for. Every amount here is derived from Core's resolved default.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DEFAULT_LLM_PROVIDER, DEFAULT_LLM_LAB_BUDGET, DEFAULT_LLM_MODEL, LLM_LAB_SCHEMA_VERSION, type LlmExecutionProfile } from "@fluxiq-web-extension/test-contracts";
import { AUTOMATION_STUDIO_LLM_TEST_RUN_COST_CEILING_DEFAULT_USD } from "fluxiq/automation-studio";
import { RunnerFailure } from "../../failure.js";
import { assertLlmMaxCostWithinCeiling, beginLiveLlmRun, LAB_COST_CEILING_ENV, LAB_COST_CEILING_FLAG, liveLlmBuildCostCeilingUsd } from "../index.js";

const FLAG = "--llm-max-cost-usd";
const DEFAULT = AUTOMATION_STUDIO_LLM_TEST_RUN_COST_CEILING_DEFAULT_USD;

function createFlow(maxEstimatedCostUsd: number): LlmExecutionProfile {
  return {
    schemaVersion: LLM_LAB_SCHEMA_VERSION, profileId: "lab-create", mode: "live", provider: DEFAULT_LLM_PROVIDER, model: DEFAULT_LLM_MODEL, task: "create-flow",
    scenarioNetworkPolicy: "loopback-only", providerEgressPolicy: "core-trusted-provider-only", externalSideEffects: false, approvalMode: "manual",
    retainRawPrompts: false, retainRawResponses: false, maxConcurrentRuns: 1, budget: { ...DEFAULT_LLM_LAB_BUDGET, maxEstimatedCostUsd },
  };
}

/** An empty checkout, so no `.env` file supplies a ceiling. */
async function checkout(t: test.TestContext): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-max-cost-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

/** Begins a live run with no provider key: a launch that gets past the cost check is refused for the key instead. */
function begin(root: string, maxCost: number | undefined, environment: NodeJS.ProcessEnv, extra: readonly string[] = []) {
  const args = ["node", "lab", "run", "--live-llm", ...extra, ...(maxCost === undefined ? [] : [FLAG, String(maxCost)])];
  return beginLiveLlmRun({ profile: createFlow(maxCost ?? DEFAULT_LLM_LAB_BUDGET.maxEstimatedCostUsd), repositoryRoot: root, environment: {}, targetMode: "isolated", costCeilingSources: { args, environment } });
}

function isCostRefusal(above: number, ceiling: number) {
  return (error: unknown) => error instanceof RunnerFailure
    && error.message.includes(`${FLAG} ${above}`)
    && error.message.includes(`$${ceiling}`)
    && error.message.includes(LAB_COST_CEILING_ENV);
}

function isNotCostRefusal(error: unknown): boolean {
  return error instanceof Error && !error.message.includes(FLAG);
}

test("a --llm-max-cost-usd above the resolved ceiling is refused, naming both numbers and how to raise the ceiling", () => {
  const above = DEFAULT * 2.5;
  assert.throws(() => assertLlmMaxCostWithinCeiling(["node", "lab", FLAG, String(above)], DEFAULT), isCostRefusal(above, DEFAULT));
});

test("a --llm-max-cost-usd equal to or below the ceiling, or no flag at all, is allowed", () => {
  assert.doesNotThrow(() => assertLlmMaxCostWithinCeiling(["node", "lab", FLAG, String(DEFAULT)], DEFAULT));
  assert.doesNotThrow(() => assertLlmMaxCostWithinCeiling(["node", "lab", FLAG, String(DEFAULT / 2)], DEFAULT));
  assert.doesNotThrow(() => assertLlmMaxCostWithinCeiling(["node", "lab"], DEFAULT));
});

test("a Claude launch refuses above its five-dollar ceiling before reading its credential", async (t) => {
  const root = await checkout(t);
  const ceiling = liveLlmBuildCostCeilingUsd(root, ["node", "lab", "--live-llm"], {});
  assert.equal(ceiling, 5);
  const above = ceiling + 1;
  await assert.rejects(begin(root, above, {}), isCostRefusal(above, ceiling));
});

test("a ceiling raised through the environment admits the same flag, and still refuses one above it", async (t) => {
  const root = await checkout(t);
  const raised = DEFAULT * 2.5;
  const environment = { [LAB_COST_CEILING_ENV]: String(raised) };
  assert.equal(liveLlmBuildCostCeilingUsd(root, [], environment), raised);
  // Equal and below pass the cost check and reach the credential, which this test withholds.
  await assert.rejects(begin(root, raised, environment), isNotCostRefusal);
  await assert.rejects(begin(root, DEFAULT, environment), isNotCostRefusal);
  await assert.rejects(begin(root, undefined, environment), isNotCostRefusal);
  const above = raised * 2;
  await assert.rejects(begin(root, above, environment), isCostRefusal(above, raised));
});

test("a ceiling lowered with --llm-cost-ceiling-usd refuses a flag between the two", async (t) => {
  const root = await checkout(t);
  const lowered = DEFAULT / 2;
  await assert.rejects(begin(root, DEFAULT, {}, [LAB_COST_CEILING_FLAG, String(lowered)]), isCostRefusal(DEFAULT, lowered));
});
