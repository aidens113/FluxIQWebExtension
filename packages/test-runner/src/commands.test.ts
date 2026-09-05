import assert from "node:assert/strict";
import test from "node:test";
import { expandMatrix, parseLabCommand } from "./commands.js";

test("parses finite run options", () => assert.deepEqual(parseLabCommand(["run", "basic-form", "--seed", "7", "--evidence", "events"]), { command: "run", scenarioId: "basic-form", seed: 7, evidence: "events" }));
test("parses explicit existing target and Flow selection", () => assert.deepEqual(parseLabCommand(["run", "basic-form", "--target", "existing", "--flow", "flow-1"]), { command: "run", scenarioId: "basic-form", evidence: "failure", target: "existing", flowId: "flow-1" }));
test("parses explicit clone target and source Flow selection", () => assert.deepEqual(parseLabCommand(["run", "basic-form", "--target", "clone", "--flow", "flow-1", "--fresh-login"]), { command: "run", scenarioId: "basic-form", evidence: "failure", target: "clone", flowId: "flow-1", freshLogin: true }));
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
  assert.throws(() => parseLabCommand(["run", "basic-form", "--target", "remote"]), /isolated, existing, or clone/);
  assert.throws(() => parseLabCommand(["run", "basic-form", "--target", "isolated", "--target", "existing"]), /only be specified once/);
  assert.throws(() => parseLabCommand(["run", "basic-form", "--unknown"]), /Unknown option/);
  assert.throws(() => parseLabCommand(["run", "basic-form", "--fresh-login", "--fresh-login"]), /only be specified once/);
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
