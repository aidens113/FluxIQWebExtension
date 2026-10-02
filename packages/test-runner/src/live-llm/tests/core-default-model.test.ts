// A build typed into the extension's chat runs on the default model of the Core
// the Lab started, because the chat makes its Flow inside Core and that Flow
// names no model. The Lab gives Core that default from the run's --llm-model,
// as FLUXIQ_LLM_DEFAULT_MODEL, and its plan records what Core was given, so a
// comparison run on deepseek-v4-pro can be started from the real chat (t233).
// Before, the Lab refused any --llm-model but the default for a chat build.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DEFAULT_LLM_LAB_BUDGET, DEFAULT_LLM_MODEL, LLM_LAB_SCHEMA_VERSION, type LlmExecutionProfile } from "@fluxiq-web-extension/test-contracts";
import type { RunAllocation } from "../../allocation.js";
import { buildFluxIQEnvironment } from "../../environment.js";
import { RunnerFailure } from "../../failure.js";
import { beginLiveLlmRun, LAB_DEFAULT_MODEL_ENV, LAB_DEFAULT_MODEL_FLAG, labDefaultModelValue, LiveLlmRun, liveLlmCoreDefaultModel, planLiveLlmExecution } from "../index.js";
import { LAB_CEILING_USD } from "./lab-ceiling.js";

const allocation: RunAllocation = {
  runId: "run-a", runRoot: path.resolve("runs/run-a"), fluxiqRoot: path.resolve("runs/run-a/fluxiq-root"),
  storageDir: path.resolve("runs/run-a/fluxiq-root/.fluxiq"), browserProfileDir: path.resolve("runs/run-a/profile"),
  coreWorkspaceDir: path.resolve("runs/run-a/core-workspace"), webWorkspaceDir: path.resolve("runs/run-a/core-workspace/apps/web"),
  logsDir: path.resolve("runs/run-a/logs"),
  scenarioPort: 31001, webPort: 31002, gatewayPort: 31003, controllerToken: "controller_token_1234567890",
};

const CREDENTIAL = { DEEPSEEK_API_KEY: "test-provider-credential-value" };

function createFlow(model: string): LlmExecutionProfile {
  return {
    schemaVersion: LLM_LAB_SCHEMA_VERSION, profileId: "lab-create", mode: "live", provider: "deepseek", model, task: "create-flow",
    scenarioNetworkPolicy: "loopback-only", providerEgressPolicy: "core-trusted-provider-only", externalSideEffects: false, approvalMode: "manual",
    retainRawPrompts: false, retainRawResponses: false, maxConcurrentRuns: 1, budget: { ...DEFAULT_LLM_LAB_BUDGET },
  };
}

async function checkout(t: test.TestContext): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-default-model-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

/** What Core is started with, and the chat-buildable run the Lab plans, for one run's arguments. */
async function bothSides(repositoryRoot: string, model: string, args: readonly string[], base: NodeJS.ProcessEnv = {}) {
  const core = buildFluxIQEnvironment(allocation, { repositoryRoot, fluxiqRepositoryRoot: "C:/core", hostModulePath: "C:/host.js" }, base, args);
  const run = await beginLiveLlmRun({ profile: createFlow(model), repositoryRoot, environment: CREDENTIAL, flowLane: false, targetMode: "isolated", costCeilingSources: { args, environment: {} } });
  return { core, run };
}

test("a chat build with --llm-model deepseek-v4-pro starts Core on it and passes the chat-build check", async (t) => {
  const root = await checkout(t);
  const { core, run } = await bothSides(root, "deepseek-v4-pro", ["node", "lab", "run", "--live-llm", LAB_DEFAULT_MODEL_FLAG, "deepseek-v4-pro"]);
  assert.equal(core[LAB_DEFAULT_MODEL_ENV], "deepseek-v4-pro");
  assert.equal(LAB_DEFAULT_MODEL_ENV, "FLUXIQ_LLM_DEFAULT_MODEL");
  assert.equal(run.createsFlow, true);
  run.assertChatBuildable();
  assert.equal(run.describe().model, "deepseek-v4-pro");
  assert.equal(run.describe().coreDefaultModel, "deepseek-v4-pro");
});

test("without --llm-model Core is given no default model, an inherited one is dropped, and a chat build runs on Core's own", async (t) => {
  const root = await checkout(t);
  const { core, run } = await bothSides(root, DEFAULT_LLM_MODEL, ["node", "lab", "run", "--live-llm"], { [LAB_DEFAULT_MODEL_ENV]: "deepseek-v4-pro" });
  assert.equal(Object.hasOwn(core, LAB_DEFAULT_MODEL_ENV), false);
  assert.equal(liveLlmCoreDefaultModel(["node", "lab"]), DEFAULT_LLM_MODEL);
  run.assertChatBuildable();
  assert.equal(run.describe().coreDefaultModel, DEFAULT_LLM_MODEL);
});

test("a chat build on a model its Core was not started on is refused before anything starts", () => {
  // The plan says deepseek-v4-pro, but the run's Core was given no default model.
  const run = new LiveLlmRun(planLiveLlmExecution(createFlow("deepseek-v4-pro"), LAB_CEILING_USD), { name: "DEEPSEEK_API_KEY", source: "test", value: CREDENTIAL.DEEPSEEK_API_KEY });
  assert.throws(() => run.assertChatBuildable(), (error: unknown) => error instanceof RunnerFailure && error.category === "fixture.invalid"
    && error.message.includes("the default model the run's Core was started with (deepseek-flash), not deepseek-v4-pro"));
});

test("an unknown --llm-model is refused before Core's environment is built or a credential is read", async (t) => {
  const root = await checkout(t);
  const args = ["node", "lab", "run", "--live-llm", LAB_DEFAULT_MODEL_FLAG, "gpt-9"];
  assert.throws(() => buildFluxIQEnvironment(allocation, { repositoryRoot: root, fluxiqRepositoryRoot: "C:/core", hostModulePath: "C:/host.js" }, {}, args), /--llm-model gpt-9 cannot be the default model of the run's Core: FLUXIQ_LLM_DEFAULT_MODEL must name a DeepSeek model/u);
  // No key anywhere: the model is refused first, so the refusal is never the missing credential.
  await assert.rejects(
    beginLiveLlmRun({ profile: createFlow("gpt-9"), repositoryRoot: root, environment: {}, flowLane: false, targetMode: "isolated", costCeilingSources: { args, environment: {} } }),
    /--llm-model gpt-9 cannot be the default model of the run's Core/u,
  );
  assert.throws(() => labDefaultModelValue(["node", "lab", LAB_DEFAULT_MODEL_FLAG]), /--llm-model needs a model id/u);
  assert.throws(() => planLiveLlmExecution(createFlow(DEFAULT_LLM_MODEL), LAB_CEILING_USD, "gpt-9"), /the run's Core default model gpt-9 is unsupported/u);
});
