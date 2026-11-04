// `--authoring-mode answer-first --llm-max-cost-usd N` reaches Core's ceiling with no
// variable to remember: the Lab starts Core in test scope, whose default is $0.10, and an
// attempt's budget is the smaller of its own and that ceiling, so otherwise it budgets out
// almost at once. Nothing else moves: without both flags every value stays what it was.

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { AUTOMATION_STUDIO_LLM_TEST_RUN_COST_CEILING_DEFAULT_USD } from "fluxiq/automation";
import type { RunAllocation } from "../../allocation.js";
import { buildFluxIQEnvironment } from "../../environment.js";
import { assertLlmMaxCostWithinCeiling, LAB_COST_CEILING_ENV, LAB_COST_CEILING_FLAG, labCostCeilingValue, liveLlmBuildCostCeilingUsd } from "../index.js";

const DEFAULT = String(AUTOMATION_STUDIO_LLM_TEST_RUN_COST_CEILING_DEFAULT_USD);
const MODE = ["--authoring-mode", "answer-first"];
const COST = (amount: string) => ["--llm-max-cost-usd", amount];

async function checkout(t: test.TestContext, envLocal?: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-answer-first-ceiling-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  if (envLocal !== undefined) await writeFile(path.join(root, ".env.local"), envLocal, "utf8");
  return root;
}

test("both flags with nothing configured: the ceiling is the budget the run named, and the budget passes it", async (t) => {
  const root = await checkout(t);
  const args = ["node", "lab", "attempt", ...MODE, ...COST("5")];
  assert.equal(labCostCeilingValue(root, args, {}), "5");
  assert.equal(liveLlmBuildCostCeilingUsd(root, args, {}), 5);
  assert.doesNotThrow(() => assertLlmMaxCostWithinCeiling(args, liveLlmBuildCostCeilingUsd(root, args, {})));
  assert.equal(labCostCeilingValue(root, [...args, "--live-llm"], {}), "5", "the paid form too");
  assert.equal(labCostCeilingValue(root, ["node", "lab", ...MODE, ...COST("7"), "--live-llm"], {}), "7", "the budget it names, not Claude's default");
  assert.equal(labCostCeilingValue(root, ["node", "lab", ...MODE, ...COST("2"), "--live-llm"], {}), "2", "a lower budget holds its Core to it too");
});

test("without both flags every value stays what it is", async (t) => {
  const root = await checkout(t);
  assert.equal(labCostCeilingValue(root, ["node", "lab", ...MODE], {}), DEFAULT, "the mode alone");
  assert.equal(labCostCeilingValue(root, ["node", "lab", ...COST("5")], {}), DEFAULT, "the budget alone");
  assert.equal(labCostCeilingValue(root, ["node", "lab", "--authoring-mode", "project", ...COST("5")], {}), DEFAULT, "another mode");
  assert.equal(labCostCeilingValue(root, ["node", "lab", "--live-llm", ...MODE], {}), "5", "Claude's live default, untouched");
  assert.throws(() => assertLlmMaxCostWithinCeiling(["node", "lab", ...COST("5")], liveLlmBuildCostCeilingUsd(root, ["node", "lab", ...COST("5")], {})), /is above the per-build cost ceiling/u);
});

test("a configured ceiling lower than the flag is still refused, by the environment or by a file", async (t) => {
  const args = ["node", "lab", ...MODE, ...COST("5")];
  const plain = await checkout(t);
  const fromEnvironment = { [LAB_COST_CEILING_ENV]: "0.25" };
  assert.equal(labCostCeilingValue(plain, args, fromEnvironment), "0.25");
  assert.throws(() => assertLlmMaxCostWithinCeiling(args, liveLlmBuildCostCeilingUsd(plain, args, fromEnvironment)), /is above the per-build cost ceiling/u);
  const withFile = await checkout(t, `${LAB_COST_CEILING_ENV}=0.25\n`);
  assert.equal(labCostCeilingValue(withFile, args, {}), "0.25");
  assert.throws(() => assertLlmMaxCostWithinCeiling(args, liveLlmBuildCostCeilingUsd(withFile, args, {})), /is above the per-build cost ceiling/u);
});

test("--llm-cost-ceiling-usd still only lowers it", async (t) => {
  const root = await checkout(t);
  const args = ["node", "lab", ...MODE, ...COST("5")];
  assert.equal(labCostCeilingValue(root, [...args, LAB_COST_CEILING_FLAG, "2"], {}), "2");
  assert.throws(() => labCostCeilingValue(root, [...args, LAB_COST_CEILING_FLAG, "6"], {}), /cannot raise/u);
});

test("above Core's maximum is Core's refusal", async (t) => {
  const root = await checkout(t);
  assert.throws(() => labCostCeilingValue(root, ["node", "lab", ...MODE, ...COST("11")], {}), /10/u);
});

test("a provider-free run's two switches open no env file for the ceiling", async (t) => {
  const root = await checkout(t, `${LAB_COST_CEILING_ENV}=0.25\n`);
  const args = ["node", "lab", ...MODE, ...COST("5")];
  assert.equal(labCostCeilingValue(root, args, { FLUXIQ_TEST_ENV_FILES: "none", FLUXIQ_PROVIDER_KEY_FILES: "none" }), "5");
  assert.equal(labCostCeilingValue(root, args, { FLUXIQ_TEST_ENV_FILES: "none" }), "0.25", "a real isolated run keeps its file's ceiling, as it always has");
});

const allocation: RunAllocation = {
  runId: "run-a", runRoot: path.resolve("runs/run-a"), fluxiqRoot: path.resolve("runs/run-a/fluxiq-root"),
  storageDir: path.resolve("runs/run-a/fluxiq-root/.fluxiq"), browserProfileDir: path.resolve("runs/run-a/profile"),
  coreWorkspaceDir: path.resolve("runs/run-a/core-workspace"), webWorkspaceDir: path.resolve("runs/run-a/core-workspace/apps/web"),
  logsDir: path.resolve("runs/run-a/logs"),
  scenarioPort: 31001, webPort: 31002, gatewayPort: 31003, controllerToken: "controller_token_1234567890",
};

test("the Core child is started with 5 and with the mode, from the flags alone", async (t) => {
  const root = await checkout(t);
  const args = ["node", "lab", "attempt", "company-website", ...MODE, "--live-llm", ...COST("5")];
  const core = buildFluxIQEnvironment(allocation, { repositoryRoot: root, fluxiqRepositoryRoot: "C:/core", hostModulePath: "C:/host.js" }, {}, args);
  assert.equal(core[LAB_COST_CEILING_ENV], "5");
  assert.equal(core.FLUXIQ_AUTHORING_MODE, "answer-first");
  const scripted = ["--authoring-mode", "answer-first", "--llm-max-cost-usd", "5", "--llm-model", "claude-sonnet-5-5"];
  const provided = buildFluxIQEnvironment(allocation, { repositoryRoot: root, fluxiqRepositoryRoot: "C:/core", hostModulePath: "C:/host.js" }, { FLUXIQ_TEST_ENV_FILES: "none", FLUXIQ_PROVIDER_KEY_FILES: "none" }, scripted);
  assert.equal(provided[LAB_COST_CEILING_ENV], "5", "a scripted run's Core, from the arguments the command gives it");
});
