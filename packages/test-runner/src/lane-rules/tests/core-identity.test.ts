import assert from "node:assert/strict";
import test from "node:test";
import { coreIdentityRequired } from "../core-identity.js";

const goal = { id: "rename-workspace", description: "Rename the workspace and save.", successFacts: [] };

test("a Flow-lane run bootstraps a Core identity even when its workflow pins no recording events, actions or playback goal", () => {
  // product-catalog and data-table shapes: an extract-only recording pins nothing (W04, W06 and W08).
  assert.equal(coreIdentityRequired({ clone: false, flowLane: true, scenario: {}, recorded: {} }), true, "the Flow lane builds its Flow from a Core recording");
  assert.equal(coreIdentityRequired({ clone: false, flowLane: false, scenario: {}, recorded: {} }), false, "the recording lane keeps its own rule");
});

test("a recording-lane run needs one for pinned recording events, pinned actions or a playback goal, and a clone run always does", () => {
  const recording = (recorded: Parameters<typeof coreIdentityRequired>[0]["recorded"], scenario: Parameters<typeof coreIdentityRequired>[0]["scenario"] = {}) => coreIdentityRequired({ clone: false, flowLane: false, scenario, recorded });
  assert.equal(recording({ recordingEvents: [{ type: "web.element.clicked", count: 1 }] }), true);
  assert.equal(recording({ actions: [{ action: "web.dom.click", outcome: "succeeded" }] }), true);
  assert.equal(recording({}, { playbackGoal: goal }), true);
  assert.equal(recording({ recordingEvents: [], actions: [] }), false, "an empty pin is no pin");
  assert.equal(coreIdentityRequired({ clone: true, flowLane: false, scenario: {}, recorded: {} }), true);
});
