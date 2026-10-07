// The authoring mode every Core the Lab starts runs in: the run's
// --authoring-mode, legacy when absent, always given to Core explicitly and
// recorded in the run's plan, so a created-Flow run builds only in legacy and
// says which mode its Core was in (t338).

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { DEFAULT_LLM_LAB_BUDGET, DEFAULT_LLM_MODEL, LLM_LAB_SCHEMA_VERSION, type LlmExecutionProfile } from "@fluxiq-web-extension/test-contracts";
import type { RunAllocation } from "../../allocation.js";
import { buildFluxIQEnvironment } from "../../environment.js";
import { LAB_AUTHORING_MODE_ENV, LAB_AUTHORING_MODE_FLAG, labAuthoringModeValue, planLiveLlmExecution } from "../index.js";
import { LAB_CEILING_USD } from "./lab-ceiling.js";

const allocation: RunAllocation = {
  runId: "run-a", runRoot: path.resolve("runs/run-a"), fluxiqRoot: path.resolve("runs/run-a/fluxiq-root"),
  storageDir: path.resolve("runs/run-a/fluxiq-root/.fluxiq"), browserProfileDir: path.resolve("runs/run-a/profile"),
  coreWorkspaceDir: path.resolve("runs/run-a/core-workspace"), webWorkspaceDir: path.resolve("runs/run-a/core-workspace/apps/web"),
  logsDir: path.resolve("runs/run-a/logs"),
  scenarioPort: 31001, webPort: 31002, gatewayPort: 31003, controllerToken: "controller_token_1234567890",
};

const profile: LlmExecutionProfile = {
  schemaVersion: LLM_LAB_SCHEMA_VERSION, profileId: "lab-create", mode: "live", provider: "deepseek", model: DEFAULT_LLM_MODEL, task: "create-flow",
  scenarioNetworkPolicy: "loopback-only", providerEgressPolicy: "core-trusted-provider-only", externalSideEffects: false, approvalMode: "manual",
  retainRawPrompts: false, retainRawResponses: false, maxConcurrentRuns: 1, budget: { ...DEFAULT_LLM_LAB_BUDGET },
};

const core = (args: readonly string[], base: NodeJS.ProcessEnv = {}) => buildFluxIQEnvironment(allocation, { repositoryRoot: path.resolve("."), fluxiqRepositoryRoot: "C:/core", hostModulePath: "C:/host.js" }, base, args);

test("Core's own variable and default, read through Core", () => {
  assert.equal(LAB_AUTHORING_MODE_ENV, "FLUXIQ_AUTHORING_MODE");
  assert.equal(LAB_AUTHORING_MODE_FLAG, "--authoring-mode");
  assert.equal(labAuthoringModeValue(["node", "cli", "run"]), "legacy");
  assert.equal(labAuthoringModeValue(["node", "cli", "--authoring-mode", "legacy"]), "legacy");
  assert.equal(labAuthoringModeValue(["node", "cli", "--authoring-mode", "candidate"]), "candidate");
});

test("a mode Core would refuse is refused before anything starts", () => {
  assert.throws(() => labAuthoringModeValue(["node", "cli", "--authoring-mode"]), /needs a mode/u);
  assert.throws(() => labAuthoringModeValue(["node", "cli", "--authoring-mode", "--live-llm"]), /needs a mode/u);
  assert.throws(() => labAuthoringModeValue(["node", "cli", "--authoring-mode", "draft"]), /cannot be the authoring mode of the run's Core: FLUXIQ_AUTHORING_MODE must be one of legacy, candidate/u);
});

test("every Core the Lab starts is given the mode explicitly, and an inherited one is dropped", () => {
  assert.equal(core(["node", "cli", "run"])[LAB_AUTHORING_MODE_ENV], "legacy");
  assert.equal(core(["node", "cli", "run"], { [LAB_AUTHORING_MODE_ENV]: "candidate" })[LAB_AUTHORING_MODE_ENV], "legacy");
  assert.equal(core(["node", "cli", "run", "--authoring-mode", "candidate"])[LAB_AUTHORING_MODE_ENV], "candidate");
  assert.equal(core(["node", "cli", "run", "--authoring-mode", "legacy"], { [LAB_AUTHORING_MODE_ENV]: "candidate" })[LAB_AUTHORING_MODE_ENV], "legacy");
  assert.throws(() => core(["node", "cli", "run", "--authoring-mode", "both"]), /cannot be the authoring mode/u);
});

test("the plan records the mode the run's Core was started in, legacy by default", () => {
  assert.equal(planLiveLlmExecution(profile, LAB_CEILING_USD).coreAuthoringMode, "legacy");
  assert.equal(planLiveLlmExecution(profile, LAB_CEILING_USD, DEFAULT_LLM_MODEL, "candidate").coreAuthoringMode, "candidate");
});
