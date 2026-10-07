import assert from "node:assert/strict";
import test from "node:test";
import { stepWords } from "../words";

// D12 of the t342 round 2 UI review (run-muylu4pp-f9cb2121, screenshot 05):
// the panel said "Changing the Flow" where the overlay said "Updating the
// Flow". One act, one word: Core's own heading for an edit is "Changing the
// Flow", and every client says it the same way.
test("an edit to the Flow is said as Core says it, \"Changing the Flow\", in either tense (D12)", () => {
  assert.equal(stepWords({ kind: "tool", title: "", status: "started", ref: "core.flow_draft" }).title, "Changing the Flow");
  assert.equal(stepWords({ kind: "tool", title: "", status: "succeeded", ref: "core.flow_draft" }).title, "Changed the Flow");
  assert.equal(stepWords({ kind: "step", title: "Amending the draft Flow", status: "started" }).title, "Changing the Flow");
  assert.equal(stepWords({ kind: "tool", title: "Changing the Flow", status: "started", ref: "core.flow_draft" }).title, "Changing the Flow");
});
