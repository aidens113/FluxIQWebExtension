// One per-build cost ceiling for the Core a Lab run starts and for the Lab's own
// plan: a value set by the run's flag, or by the checkout's `.env.local`, must
// reach both. Before, the Lab's plan read only its own environment at import,
// so a flag raised Core's ceiling while the Lab kept judging builds by the old one.

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DEFAULT_LLM_LAB_BUDGET, DEFAULT_LLM_MODEL, LLM_LAB_SCHEMA_VERSION, type LlmExecutionProfile } from "@fluxiq-web-extension/test-contracts";
import { AUTOMATION_STUDIO_LLM_TEST_RUN_COST_CEILING_DEFAULT_USD } from "fluxiq/automation-studio";
import type { RunAllocation } from "../../allocation.js";
import { buildFluxIQEnvironment } from "../../environment.js";
import { beginLiveLlmRun, LAB_COST_CEILING_ENV, LAB_COST_CEILING_SCOPE_ENV, LAB_COST_CEILING_FLAG } from "../index.js";

const allocation: RunAllocation = {
  runId: "run-a", runRoot: path.resolve("runs/run-a"), fluxiqRoot: path.resolve("runs/run-a/fluxiq-root"),
  storageDir: path.resolve("runs/run-a/fluxiq-root/.fluxiq"), browserProfileDir: path.resolve("runs/run-a/profile"),
  coreWorkspaceDir: path.resolve("runs/run-a/core-workspace"), webWorkspaceDir: path.resolve("runs/run-a/core-workspace/apps/web"),
  logsDir: path.resolve("runs/run-a/logs"),
  scenarioPort: 31001, webPort: 31002, gatewayPort: 31003, controllerToken: "controller_token_1234567890",
};

const profile: LlmExecutionProfile = {
  schemaVersion: LLM_LAB_SCHEMA_VERSION, profileId: "lab-adapt", mode: "live", provider: "deepseek", model: DEFAULT_LLM_MODEL, task: "adapt",
  scenarioNetworkPolicy: "loopback-only", providerEgressPolicy: "core-trusted-provider-only", externalSideEffects: false, approvalMode: "manual",
  retainRawPrompts: false, retainRawResponses: false, maxConcurrentRuns: 1, budget: { ...DEFAULT_LLM_LAB_BUDGET },
};

async function checkout(t: test.TestContext, envLocal?: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-cost-ceiling-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  if (envLocal !== undefined) await writeFile(path.join(root, ".env.local"), envLocal, "utf8");
  return root;
}

/** What Core is started with, and what the Lab's plan holds each build to, for one run's arguments and environment. */
async function bothSides(repositoryRoot: string, args: readonly string[], environment: NodeJS.ProcessEnv) {
  const core = buildFluxIQEnvironment(allocation, { repositoryRoot, fluxiqRepositoryRoot: "C:/core", hostModulePath: "C:/host.js" }, environment, args);
  const run = await beginLiveLlmRun({
    profile, repositoryRoot, environment: { DEEPSEEK_API_KEY: "test-provider-credential-value" }, flowLane: true, targetMode: "isolated",
    costCeilingSources: { args, environment },
  });
  assert.equal(core[LAB_COST_CEILING_SCOPE_ENV], "test");
  return { core: core[LAB_COST_CEILING_ENV], plan: run.describe().authorized.maxTotalEstimatedCostUsd };
}

test("a ceiling from the run's flag reaches both Core's environment and the Lab's plan", async (t) => {
  const root = await checkout(t, `${LAB_COST_CEILING_ENV}=0.05\n`);
  // The flag wins over the environment and the file, on both sides.
  assert.deepEqual(await bothSides(root, ["node", "lab", LAB_COST_CEILING_FLAG, "0.03"], { [LAB_COST_CEILING_ENV]: "0.04" }), { core: "0.03", plan: 0.03 });
});

test("a ceiling from the checkout's .env.local reaches both Core's environment and the Lab's plan", async (t) => {
  const root = await checkout(t, `${LAB_COST_CEILING_ENV}=0.07\n`);
  assert.deepEqual(await bothSides(root, ["node", "lab"], {}), { core: "0.07", plan: 0.07 });
});

test("with no ceiling configured the Lab still explicitly scopes Core to the test default", async (t) => {
  const root = await checkout(t);
  assert.deepEqual(await bothSides(root, ["node", "lab"], {}), { core: "0.1", plan: AUTOMATION_STUDIO_LLM_TEST_RUN_COST_CEILING_DEFAULT_USD });
});

test("a higher per-run override is refused before Core starts or the Lab plans provider work", async (t) => {
  const root = await checkout(t, `${LAB_COST_CEILING_ENV}=0.10\n`);
  await assert.rejects(bothSides(root, ["node", "lab", LAB_COST_CEILING_FLAG, "0.30"], {}), /cannot raise the configured Lab ceiling/u);
});
