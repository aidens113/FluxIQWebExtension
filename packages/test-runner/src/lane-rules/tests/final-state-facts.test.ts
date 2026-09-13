import assert from "node:assert/strict";
import test from "node:test";
import type { ExpectedFact } from "@fluxiq-web-extension/test-contracts";
import { finalStateFacts } from "../final-state-facts.js";

/** identity-drift's shape: the goal is the save, and `save-and-exit` requires the status line to stay empty. */
const saved: ExpectedFact = { id: "settings-saved", subject: "save-status", predicate: "text", value: "Saved: Workspace" };
const nothingSaved: ExpectedFact = { id: "nothing-saved", subject: "save-status", predicate: "text", value: "" };
const formShown: ExpectedFact = { id: "settings-form-visible", subject: "settings-form", predicate: "visible", value: true };
const scenario = { playbackGoal: { id: "rename-workspace", description: "Rename the workspace and save.", successFacts: [saved] } };

test("a positive run of the primary workflow is judged on its final state, then the playback goal's success facts", () => {
  assert.deepEqual(finalStateFacts(scenario, { workflowId: undefined, expected: { finalState: [formShown] } }), [formShown, saved]);
  // W20-W23: a drift variant expecting success keeps the goal.
  assert.deepEqual(finalStateFacts(scenario, { workflowId: undefined, expected: { finalState: [saved] } }), [saved, saved]);
});

test("a negative run is judged on its own final state and not on the playback goal (W29 save-and-exit)", () => {
  const negative = { workflowId: undefined, expected: { finalState: [nothingSaved], failure: { category: "target_not_found" as const, code: "web.target.not_found" } } };
  assert.deepEqual(finalStateFacts(scenario, negative), [nothingSaved]);
});

test("a named workflow is judged on its own final state only, and a scenario without a goal adds nothing", () => {
  assert.deepEqual(finalStateFacts(scenario, { workflowId: "other", expected: { finalState: [formShown] } }), [formShown]);
  assert.deepEqual(finalStateFacts({}, { workflowId: undefined, expected: {} }), []);
});
