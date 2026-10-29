import assert from "node:assert/strict";
import test from "node:test";
import { matrixRecoveryActivities } from "../recovery-activities.js";

const LIKE = "node.bootstrap.0123456789abcdef.main.like";

function event(sequence: number, detail: unknown, subject: unknown = { kind: "run", id: "run-1", projectId: "project-1" }) {
  return { activityId: "run:run-1", sequence, subject, phase: "running", label: "Recovered: Found the item again", detail };
}

test("a snapshot's recovery rows are read once each, in sequence order, with Core's subject", () => {
  const found = event(7, { kind: "step", title: "x", status: "succeeded", ref: LIKE, recovery: { kind: "reacquire", subject: "Found the item from “read the long posts in the feed” again", outcome: "succeeded" } });
  const rows = matrixRecoveryActivities({ current: found, recent: [event(3, { kind: "step", ref: LIKE }), event(5, { kind: "step", ref: LIKE, recovery: { kind: "interference", subject: "Closed a notice", outcome: "succeeded" } }), found] });
  assert.deepEqual(rows.map(row => [row.sequence, row.kind, row.outcome]), [[5, "interference", "succeeded"], [7, "reacquire", "succeeded"]]);
  assert.deepEqual(rows[1], { sequence: 7, subjectKind: "run", subjectId: "run-1", nodeId: LIKE, kind: "reacquire", outcome: "succeeded", subject: "Found the item from “read the long posts in the feed” again" });
});

test("a row that is not a step, names a kind or outcome Core has not got, or has no sequence is not read", () => {
  const rows = matrixRecoveryActivities({
    current: null,
    recent: [
      event(1, { kind: "build", recovery: { kind: "reacquire", subject: "s", outcome: "succeeded" } }),
      event(2, { kind: "step", ref: LIKE, recovery: { kind: "guess", subject: "s", outcome: "succeeded" } }),
      event(3, { kind: "step", ref: LIKE, recovery: { kind: "reacquire", subject: "s", outcome: "maybe" } }),
      { ...event(4, { kind: "step", ref: LIKE, recovery: { kind: "reacquire", subject: "s", outcome: "failed" } }), sequence: "4" },
      event(5, { kind: "step", ref: LIKE, recovery: { kind: "reacquire", subject: "s", outcome: "failed" } }, { kind: "session", id: "x" }),
    ],
  });
  assert.deepEqual(rows, []);
  assert.deepEqual(matrixRecoveryActivities(undefined), []);
});
