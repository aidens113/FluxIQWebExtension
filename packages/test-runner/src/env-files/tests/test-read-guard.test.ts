import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { assertTestMayReadEnvFile, runningUnderTestRunner } from "../index.js";

/**
 * The fence between a test and this machine's real provider key: inside a
 * test, no env file is read outside the temporary directory. The first case is
 * the one that keeps the fence standing: if Node ever stopped marking a test
 * process, it fails here instead of the guard quietly allowing everything.
 */

test("this process is recognised as a test, however it was started", () => {
  assert.equal(runningUnderTestRunner(), true);
  assert.equal(runningUnderTestRunner({ NODE_TEST_CONTEXT: "child-v8" }, ["node", "cli.js"], []), true, "a child of node --test");
  assert.equal(runningUnderTestRunner({}, ["node", "dist/tests/target-config.test.js"], []), true, "a test file run on its own");
  assert.equal(runningUnderTestRunner({}, ["node", "x.js"], ["--test"]), true);
  assert.equal(runningUnderTestRunner({}, ["node", "dist/cli.js", "run", "everything-store"], []), false, "the Lab's own CLI");
});

test("a test reads env files only under the temporary directory", (context: TestContext) => {
  const made = mkdtempSync(path.join(tmpdir(), "fluxiq-env-guard-"));
  context.after(() => rmSync(made, { recursive: true, force: true }));
  assert.doesNotThrow(() => assertTestMayReadEnvFile(made, ".env.local"));
  assert.doesNotThrow(() => assertTestMayReadEnvFile(path.join(made, "nested"), ".env"));
  const checkout = path.resolve(import.meta.dirname, "..", "..", "..");
  assert.throws(() => assertTestMayReadEnvFile(checkout, ".env.local"), /A test may read \.env\.local only from a temporary directory it made, and .* is not one/u);
  assert.throws(() => assertTestMayReadEnvFile(tmpdir(), ".env"), /only from a temporary directory it made/u, "the temporary directory itself is no test's own");
  assert.throws(() => assertTestMayReadEnvFile(path.join(made, "..", "..", "elsewhere"), ".env"), /only from a temporary directory it made/u);
});

test("outside a test the guard allows every directory", () => {
  assert.doesNotThrow(() => assertTestMayReadEnvFile(path.resolve(import.meta.dirname, "..", "..", ".."), ".env.local", false));
});
