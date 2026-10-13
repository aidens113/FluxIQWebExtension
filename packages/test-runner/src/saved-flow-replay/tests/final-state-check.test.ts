import assert from "node:assert/strict";
import test from "node:test";
import type { ExpectedFact } from "@fluxiq-web-extension/test-contracts";
import { replayFinalStateFacts } from "../final-state-check.js";

/** A dataset-judged task that acts on some rows: the rows it leaves alone must stay as they were. */
const leftAlone: ExpectedFact = { id: "other-row-untouched", subject: "row-b-status", predicate: "text", value: "pending" };
const acted: ExpectedFact = { id: "chosen-row-acted", subject: "row-a-status", predicate: "text", value: "done" };
const goal: ExpectedFact = { id: "goal", subject: "page-status", predicate: "text", value: "Finished" };
const scenario = { playbackGoal: { id: "finish", description: "Finish the task.", successFacts: [goal] } };

test("a dataset-judged task that declares a final state is checked against it, as the created-Flow lane judges it", () => {
  const workflow = { workflowId: "act-on-some", expected: { finalState: [acted, leftAlone] } };
  assert.deepEqual(replayFinalStateFacts("expected-dataset", scenario, workflow), [acted, leftAlone]);
});

test("a dataset-judged task with no final state checks only its rows", () => {
  assert.equal(replayFinalStateFacts("expected-dataset", scenario, { workflowId: "read-only", expected: {} }), null);
  assert.equal(replayFinalStateFacts("expected-dataset", scenario, { workflowId: "read-only", expected: { finalState: [] } }), null);
});

test("a goal-judged task is checked against its final state and the playback goal, unchanged", () => {
  assert.deepEqual(replayFinalStateFacts("playback-goal", scenario, { workflowId: undefined, expected: { finalState: [acted] } }), [acted, goal]);
});
