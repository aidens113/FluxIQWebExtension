import assert from "node:assert/strict";
import test from "node:test";
import { cleanupFailureOutcome } from "../cleanup-failure-precedence.js";

test("a browser cleanup failure is primary only when the scenario had no earlier failure", () => {
  const outcome = cleanupFailureOutcome({ category: undefined, message: undefined }, "browser", new Error("close refused"));
  assert.deepEqual(outcome.primary, { category: "process.startup", message: "Browser cleanup failed: Error: close refused" });
  assert.deepEqual(outcome.event.details, { failureCategory: "process.startup", cleanupStage: "browser" });
});

test("browser, topology and clone completion failures keep the first scenario failure and append labelled events", () => {
  for (const stage of ["browser", "topology", "clone-source-verification", "clone-destination"] as const) {
    const outcome = cleanupFailureOutcome({ category: "runtime.behavior", message: "fixture assertion failed" }, stage, "cleanup refused");
    assert.deepEqual(outcome.primary, { category: "runtime.behavior", message: "fixture assertion failed" });
    assert.equal(outcome.event.details.failureCategory, "process.startup");
    assert.equal(outcome.event.details.cleanupStage, stage);
    assert.equal(outcome.event.details.primaryFailureCategory, "runtime.behavior");
    assert.match(outcome.event.summary, /failed: cleanup refused/);
  }
});

test("clone source verification keeps its classified category when it is the first failure", () => {
  const outcome = cleanupFailureOutcome({ category: undefined, message: undefined }, "clone-source-verification", "source changed", "runtime.behavior");
  assert.deepEqual(outcome.primary, { category: "runtime.behavior", message: "Clone source post-run verification failed: source changed" });
  assert.equal(outcome.event.details.failureCategory, "runtime.behavior");
});
