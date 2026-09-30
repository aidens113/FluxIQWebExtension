// Parser 1: flows joined to their newest run, newest first, at most thirty, and
// nothing Core sent wrongly shaped gets through.

import assert from "node:assert/strict";
import test from "node:test";
import { automationRows } from "../rows";

const flow = (flowId: string, updatedAt: string, name: unknown = `Flow ${flowId}`) => ({ flowId, name, updatedAt, nodeCount: 3 });
const run = (runId: string, flowId: string, updatedAt: string, status = "succeeded") => ({
  runId, flowId, status, updatedAt, interventionCount: 0, adaptationCount: 0
});

test("each flow is joined to its newest run by updatedAt", () => {
  const rows = automationRows({
    flows: [flow("a", "2026-09-01T00:00:00Z")],
    runs: [run("old", "a", "2026-09-02T00:00:00Z"), run("new", "a", "2026-09-03T00:00:00Z"), run("mid", "a", "2026-09-02T12:00:00Z")]
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.name, "Flow a");
  assert.equal(rows[0]?.lastRun?.runId, "new");
});

test("rows are newest first by their latest activity, capped at thirty", () => {
  const ids = Array.from({ length: 32 }, (_, index) => `f${index + 1}`);
  const flows = ids.map((id, index) => flow(id, new Date(Date.UTC(2026, 8, 1, index)).toISOString()));
  const rows = automationRows({ flows, runs: [run("r", "f1", "2026-09-20T00:00:00Z")] });
  assert.equal(rows.length, 30);
  assert.deepEqual(rows.slice(0, 3).map((row) => row.flowId), ["f1", "f32", "f31"], "f1's run makes it newest");
  assert.equal(rows.at(-1)?.flowId, "f4", "the two oldest drop");
});

test("a flow with no run has no lastRun, and a nameless flow is still listed", () => {
  const rows = automationRows({ flows: [flow("a", "2026-09-01T00:00:00Z", 42)], runs: [] });
  assert.deepEqual(rows, [{ flowId: "a", name: "Untitled automation" }]);
});

test("junk is skipped: missing ids, non-objects, runs for unknown flows, duplicate flows", () => {
  const rows = automationRows({
    flows: [null, "x", { name: "no id" }, flow("a", "2026-09-01T00:00:00Z"), flow("a", "2026-09-05T00:00:00Z", "dup")],
    runs: [7, { flowId: "a" }, run("r", "ghost", "2026-09-09T00:00:00Z")]
  });
  assert.deepEqual(rows, [{ flowId: "a", name: "Flow a" }]);
});

test("a payload that is not a list answer yields no rows", () => {
  assert.deepEqual(automationRows(undefined), []);
  assert.deepEqual(automationRows({ flows: "nope", runs: {} }), []);
});
