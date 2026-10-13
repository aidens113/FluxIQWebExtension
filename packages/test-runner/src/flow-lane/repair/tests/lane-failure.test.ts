import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../../failure.js";
import { liveRepairLaneFailure } from "../lane-failure.js";

test("an oracle failure is kept as its category, never its message, which may quote the page", () => {
  const failure = new RunnerFailure("runtime.behavior", "Extract step extract-first-page yielded 15 record(s), expected 16", { details: { stepId: "extract-first-page", expectedCount: 16, actualCount: 15 } });
  assert.deepEqual(liveRepairLaneFailure(failure), { category: "runtime.behavior", code: null });
});

test("a closed code on the failure is kept, and anything that is not one is dropped", () => {
  assert.deepEqual(liveRepairLaneFailure(new RunnerFailure("runtime.behavior", "m", { details: { code: "lab.candidate_not_promoted" } })), { category: "runtime.behavior", code: "lab.candidate_not_promoted" });
  assert.deepEqual(liveRepairLaneFailure(new RunnerFailure("runtime.behavior", "m", { details: { reasonCode: "adaptation.payload_malformed" } })), { category: "runtime.behavior", code: "adaptation.payload_malformed" });
  assert.deepEqual(liveRepairLaneFailure(new RunnerFailure("runtime.behavior", "m", { details: { code: "Buy now pressed" } })), { category: "runtime.behavior", code: null });
  assert.deepEqual(liveRepairLaneFailure(new Error("plain")), { category: "unknown", code: null });
});
