import assert from "node:assert/strict";
import test from "node:test";
import { flowActionTimings, runActionStatus } from "../action-timings.js";

test("statuses outside the run contract are recorded as unknown", () => {
  assert.equal(runActionStatus("succeeded"), "succeeded");
  assert.equal(runActionStatus("timed_out"), "timed_out");
  assert.equal(runActionStatus("exploded"), "unknown");
  assert.equal(runActionStatus(undefined), "unknown");
});

test("Flow action attempts become timings in attempt order; an unfinished attempt has no duration", () => {
  const started = Date.parse("2026-09-11T10:00:00.000Z");
  assert.deepEqual(flowActionTimings([
    { attemptId: "a2", nodeId: "n2", definitionId: "web.dom.click", order: 2, status: "running", startedAt: started + 500 },
    { attemptId: "a1", nodeId: "n1", definitionId: "web.dom.type", order: 1, status: "succeeded", startedAt: started, finishedAt: started + 120.4 },
  ]), [
    { actionType: "web.dom.type", startedAt: "2026-09-11T10:00:00.000Z", durationMs: 120, status: "succeeded" },
    { actionType: "web.dom.click", startedAt: "2026-09-11T10:00:00.500Z", status: "running" },
  ]);
});
