import assert from "node:assert/strict";
import test from "node:test";
import { expandMatrix, parseLabCommand } from "./commands.js";

test("parses finite run options", () => assert.deepEqual(parseLabCommand(["run", "basic-form", "--seed", "7", "--evidence", "events"]), { command: "run", scenarioId: "basic-form", seed: 7, evidence: "events" }));
test("parses explicit existing target and Flow selection", () => assert.deepEqual(parseLabCommand(["run", "basic-form", "--target", "existing", "--flow", "flow-1"]), { command: "run", scenarioId: "basic-form", evidence: "failure", target: "existing", flowId: "flow-1" }));
test("parses explicit clone target and source Flow selection", () => assert.deepEqual(parseLabCommand(["run", "basic-form", "--target", "clone", "--flow", "flow-1", "--fresh-login"]), { command: "run", scenarioId: "basic-form", evidence: "failure", target: "clone", flowId: "flow-1", freshLogin: true }));
test("parses persistent isolated run and matrix workspaces", () => {
  assert.deepEqual(parseLabCommand(["run", "basic-form", "--target", "persistent-isolated", "--workspace", "browser-dev"]), { command: "run", scenarioId: "basic-form", evidence: "failure", target: "persistent-isolated", workspace: "browser-dev" });
  assert.deepEqual(parseLabCommand(["matrix", "--all", "--target", "persistent-isolated", "--workspace", "browser-dev"]), { command: "matrix", all: true, repeat: 1, evidence: "failure", target: "persistent-isolated", workspace: "browser-dev" });
});
test("parses a launch-once interactive workspace and rejects unsupported clone mode", () => {
  assert.deepEqual(parseLabCommand(["interactive", "basic-form", "--target", "persistent-isolated", "--workspace", "browser-dev", "--seed", "4"]), { command: "interactive", scenarioId: "basic-form", target: "persistent-isolated", workspace: "browser-dev", seed: 4 });
  assert.throws(() => parseLabCommand(["interactive", "basic-form", "--target", "clone"]), /does not support clone/);
  assert.throws(() => parseLabCommand(["interactive", "basic-form", "--flow", "flow-1"]), /Unknown option/);
});
test("parses auth controls and fresh-login mode", () => {
  assert.deepEqual(parseLabCommand(["auth", "status"]), { command: "auth", operation: "status" });
  assert.deepEqual(parseLabCommand(["auth", "clear"]), { command: "auth", operation: "clear" });
  assert.deepEqual(parseLabCommand(["run", "basic-form", "--target", "existing", "--fresh-login"]), { command: "run", scenarioId: "basic-form", evidence: "failure", target: "existing", freshLogin: true });
  assert.throws(() => parseLabCommand(["auth", "status", "extra"]), /Usage: lab auth/);
});
test("parses non-secret clone cache controls", () => {
  assert.deepEqual(parseLabCommand(["clone-cache", "status"]), { command: "clone-cache", operation: "status" });
  assert.deepEqual(parseLabCommand(["clone-cache", "refresh"]), { command: "clone-cache", operation: "refresh" });
  assert.deepEqual(parseLabCommand(["clone-cache", "clear"]), { command: "clone-cache", operation: "clear" });
  assert.throws(() => parseLabCommand(["clone-cache", "dump"]), /Usage: lab clone-cache/);
});
test("rejects invalid, duplicate, and unknown target options", () => {
  assert.throws(() => parseLabCommand(["run", "basic-form", "--target", "remote"]), /isolated, persistent-isolated, existing, or clone/);
  assert.throws(() => parseLabCommand(["run", "basic-form", "--target", "isolated", "--target", "existing"]), /only be specified once/);
  assert.throws(() => parseLabCommand(["run", "basic-form", "--unknown"]), /Unknown option/);
  assert.throws(() => parseLabCommand(["run", "basic-form", "--fresh-login", "--fresh-login"]), /only be specified once/);
  assert.throws(() => parseLabCommand(["run", "basic-form", "--target", "persistent-isolated"]), /--workspace is required/);
  assert.throws(() => parseLabCommand(["run", "basic-form", "--target", "persistent-isolated", "--workspace", "../escape"]), /portable name/);
  assert.throws(() => parseLabCommand(["run", "basic-form", "--target", "persistent-isolated", "--workspace", "dev", "--flow", "flow-1"]), /cannot use --flow/);
  assert.throws(() => parseLabCommand(["run", "basic-form", "--target", "persistent-isolated", "--workspace", "dev", "--fresh-login"]), /cannot use --flow or --fresh-login/);
  assert.throws(() => parseLabCommand(["run", "basic-form", "--target", "existing", "--workspace", "dev"]), /requires --target persistent-isolated/);
  assert.throws(() => parseLabCommand(["run", "basic-form", "--target", "persistent-isolated", "--workspace", "dev", "--workspace", "other"]), /only be specified once/);
});
test("expands matrix repeats deterministically", () => {
  const command = parseLabCommand(["matrix", "--scenarios-json", '["basic-form","navigation"]', "--repeat", "2"]);
  assert.equal(command.command, "matrix");
  if (command.command === "matrix") assert.deepEqual(expandMatrix(command, []), [
    { scenarioId: "basic-form", repeatIndex: 0 }, { scenarioId: "basic-form", repeatIndex: 1 },
    { scenarioId: "navigation", repeatIndex: 0 }, { scenarioId: "navigation", repeatIndex: 1 },
  ]);
});
test("matrix fails closed without an explicit selection", () => assert.throws(() => parseLabCommand(["matrix"]), /exactly one/));
test("parses explicit live LLM mode with conservative defaults", () => {
  const command = parseLabCommand([
    "run", "basic-form", "--live-llm", "--llm-profile", "deepseek-lab",
    "--llm-provider", "deepseek", "--llm-model", "configured-by-ui", "--llm-task", "diagnose",
  ]);
  assert.equal(command.command, "run");
  if (command.command !== "run") return;
  assert.deepEqual(command.llm, {
    schemaVersion: "0.1", profileId: "deepseek-lab", mode: "live",
    provider: "deepseek", model: "configured-by-ui", task: "diagnose",
    scenarioNetworkPolicy: "loopback-only",
    providerEgressPolicy: "core-trusted-provider-only", externalSideEffects: false, approvalMode: "manual",
    retainRawPrompts: false, retainRawResponses: false, maxConcurrentRuns: 1,
    budget: {
      maxInputTokens: 8_000, maxOutputTokens: 2_000, maxTotalTokensPerRequest: 10_000,
      maxCallsPerRun: 2, timeoutMs: 30_000, maxRetries: 0, maxEstimatedCostUsd: 0.25,
    },
  });
});

test("live LLM CLI fails closed without opt-in or required non-secret identity", () => {
  assert.throws(() => parseLabCommand(["run", "basic-form", "--llm-provider", "deepseek"]), /explicit --live-llm/);
  assert.throws(() => parseLabCommand(["run", "basic-form", "--live-llm"]), /--llm-profile is required/);
  assert.throws(() => parseLabCommand([
    "run", "basic-form", "--live-llm", "--llm-profile", "p", "--llm-provider", "deepseek",
    "--llm-model", "m", "--llm-task", "invalid",
  ]), /--llm-task is invalid/);
});

test("live LLM CLI rejects unsafe budgets and multi-run matrices", () => {
  const base = ["--live-llm", "--llm-profile", "p", "--llm-provider", "deepseek", "--llm-model", "m", "--llm-task", "diagnose"];
  assert.throws(() => parseLabCommand(["run", "basic-form", ...base, "--llm-max-total-tokens", "50001"]), /50000/);
  assert.throws(() => parseLabCommand(["run", "basic-form", ...base, "--llm-max-input-tokens", "9000"]), /must cover/);
  assert.throws(() => parseLabCommand(["run", "basic-form", ...base, "--llm-max-calls", "3"]), /from 1 to 2/);
  assert.throws(() => parseLabCommand(["run", "basic-form", ...base, "--llm-max-cost-usd", "0.26"]), /0.25/);
  const lowerCost = parseLabCommand(["run", "basic-form", ...base, "--llm-max-cost-usd", "0.10"]);
  assert.equal(lowerCost.command === "run" ? lowerCost.llm?.budget.maxEstimatedCostUsd : undefined, 0.1);
  assert.throws(() => parseLabCommand(["matrix", "--all", ...base]), /exactly one explicit scenario/);
  assert.throws(() => parseLabCommand(["matrix", "--scenarios-json", '["basic-form"]', "--repeat", "2", ...base]), /--repeat 1/);
  const one = parseLabCommand(["matrix", "--scenarios-json", '["basic-form"]', ...base]);
  assert.equal(one.command, "matrix");
});
