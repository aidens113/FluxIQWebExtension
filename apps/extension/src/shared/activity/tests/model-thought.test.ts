// Coverage of model-thought.ts: which of Core's rows are the model's words (a
// reason, a refusal, a recovery choice) and which are status: Core's own
// deciding row, with or without text, and every tool, note or check row.

import assert from "node:assert/strict";
import test from "node:test";

import { isModelThought, type ClientGatewayActivity } from "../index";

function event(detail: ClientGatewayActivity["detail"], label = "Clicking “Set as my store”"): ClientGatewayActivity {
  return { activityId: "build:b1", sequence: 1, subject: { kind: "build", id: "b1", projectId: "p" }, phase: "exploring", label, at: "2026-10-03T00:00:00.000Z", ...(detail ? { detail } : {}) };
}

test("a thought row with the model's words is a thought: a reason for a step, or a refused edit", () => {
  assert.equal(isModelThought(event({ kind: "thought", title: "Clicking “Set as my store”", text: "Store chooser is open; I'll press it.", status: "succeeded" })), true);
  assert.equal(isModelThought(event({ kind: "thought", title: "Didn't change the Flow", text: "That step has no such value to make vary; so this was not done: adding the pape…", status: "failed" }, "Didn't change the Flow")), true);
});

test("Core's own deciding row is status, even when it carries Core's sentence; so is a thought with no words", () => {
  assert.equal(isModelThought(event({ kind: "thought", title: "Deciding the next step", status: "started" }, "Deciding the next step")), false);
  assert.equal(isModelThought(event({ kind: "thought", title: "Deciding the next step", status: "failed", text: "The AI model provider did not answer this request. Asking it again; the build stops if it keeps not answering." }, "The AI model provider did not answer")), false);
  assert.equal(isModelThought(event({ kind: "thought", title: "Clicking “X”", text: "   ", status: "succeeded" })), false);
});

test("tool, note and check rows, and a row with no detail, are never thoughts", () => {
  assert.equal(isModelThought(event(undefined)), false);
  assert.equal(isModelThought(event({ kind: "tool", title: "Clicking “X”", text: "Result: web.action.succeeded", status: "succeeded", ref: "core.run_node" })), false);
  assert.equal(isModelThought(event({ kind: "note", title: "Judging the Flow", text: "The Flow was tested from its start." })), false);
  assert.equal(isModelThought(event({ kind: "check", title: "Result check", text: "The model judged that the result answers the request.", status: "succeeded" })), false);
});
