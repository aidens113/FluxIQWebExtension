import assert from "node:assert/strict";
import test from "node:test";
import { flowActionTimings, runActionStatus } from "../action-timings.js";

test("statuses outside the run contract are recorded as unknown", () => {
  assert.equal(runActionStatus("succeeded"), "succeeded");
  assert.equal(runActionStatus("timed_out"), "timed_out");
  assert.equal(runActionStatus("exploded"), "unknown");
  assert.equal(runActionStatus(undefined), "unknown");
});

test("an attempt reports the output its Flow node dispatches, not the policy-action definition every recorded action shares", () => {
  const started = Date.parse("2026-09-11T10:00:00.000Z");
  // Core's real shape: each recorded action is one `builtin.policy.action`
  // node and the stored attempt drops the node's inputs, so only `nodeId`
  // separates a type from a click.
  assert.deepEqual(flowActionTimings([
    { attemptId: "a2", nodeId: "node.two", definitionId: "builtin.policy.action", order: 2, status: "succeeded", startedAt: started + 200, finishedAt: started + 260 },
    { attemptId: "a1", nodeId: "node.one", definitionId: "builtin.policy.action", order: 1, status: "succeeded", startedAt: started, finishedAt: started + 120 },
  ], new Map([["node.one", "web.dom.type"], ["node.two", "web.dom.click"]])), [
    { actionType: "web.dom.type", startedAt: "2026-09-11T10:00:00.000Z", durationMs: 120, status: "succeeded" },
    { actionType: "web.dom.click", startedAt: "2026-09-11T10:00:00.200Z", durationMs: 60, status: "succeeded" },
  ]);
});

test("a node the Flow does not declare keeps its definition id, which is that node's action", () => {
  const started = Date.parse("2026-09-11T10:00:00.000Z");
  assert.deepEqual(flowActionTimings([
    { attemptId: "a1", nodeId: "node.native", definitionId: "builtin.flow.delay", order: 1, status: "succeeded", startedAt: started, finishedAt: started + 10 },
  ], new Map([["node.other", "web.dom.type"]])), [
    { actionType: "builtin.flow.delay", startedAt: "2026-09-11T10:00:00.000Z", durationMs: 10, status: "succeeded" },
  ]);
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
