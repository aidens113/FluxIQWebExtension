// The chat header's rules: the phase chip and its colour, "Step N of M"
// (1-based, just "Step N" past the count), the live/offline dot with its
// reason, and when the on-page overlay control is usable.

import assert from "node:assert/strict";
import test from "node:test";
import type { ActivityFeedSnapshot } from "../../feed";
import { activityEvent, relayState } from "../../tests/activity-fixture";
import { chatHeaderModel } from "../header-model";
import { stepText } from "../step-text";

function snapshot(fields: Partial<ActivityFeedSnapshot> = {}): ActivityFeedSnapshot {
  return { reach: "ready", state: relayState([]), overlaySaving: false, ...fields };
}

test("an empty relay state (a worker restart) reads as idle, cleanly", () => {
  const model = chatHeaderModel(snapshot({ state: { current: null, recent: [], overlay: "expanded", live: true } }), true);
  assert.equal(model.phase, "idle");
  assert.equal(model.phaseLabel, "Idle");
  assert.equal(model.tone, "neutral");
  assert.equal(model.label, "Nothing running right now.");
  assert.equal(model.step, undefined);
  assert.equal(model.live, true);
});

test("the current event names the phase, its colour, Core's sentence and the step", () => {
  const current = activityEvent(4, { phase: "running", label: "Running step 2 of 5", step: { index: 2, count: 5, label: "Open results" } });
  const model = chatHeaderModel(snapshot({ state: relayState([current]) }), true);
  assert.deepEqual([model.phase, model.phaseLabel, model.tone], ["running", "Running", "accent"]);
  assert.equal(model.label, "Running step 2 of 5");
  assert.equal(model.step, "Step 2 of 5: Open results");
  assert.deepEqual(
    (["repairing", "waiting_permission", "done", "failed"] as const).map((phase) => chatHeaderModel(snapshot({ state: relayState([activityEvent(1, { phase })]) }), true).tone),
    ["warning", "warning", "success", "danger"]
  );
});

test("a phase this build does not know reads as idle rather than breaking", () => {
  const odd = activityEvent(1, { phase: "toString" as never, label: "" });
  const model = chatHeaderModel(snapshot({ state: relayState([odd]) }), true);
  assert.equal(model.phase, "idle");
  assert.equal(model.label, "Idle");
});

test("Step N of M is 1-based, and just Step N past the count or without one", () => {
  assert.equal(stepText({ index: 1, count: 3 }), "Step 1 of 3");
  assert.equal(stepText({ index: 3, count: 3 }), "Step 3 of 3");
  assert.equal(stepText({ index: 4, count: 3 }), "Step 4");
  assert.equal(stepText({ index: 2, count: 0 }), "Step 2");
  assert.equal(stepText({ index: 2, count: Number.NaN }), "Step 2");
  assert.equal(stepText({ index: 0, count: 3 }), undefined);
  assert.equal(stepText({ index: 1.5, count: 3 }), undefined);
  assert.equal(stepText(undefined), undefined);
  assert.equal(stepText({ index: 1, count: 2, label: "   " }), "Step 1 of 2");
});

test("live only when the relay answers, a session is ready and FluxIQ is connected; each offline says why", () => {
  assert.equal(chatHeaderModel(snapshot(), true).liveLabel, "Live");
  assert.equal(chatHeaderModel(snapshot(), false).live, false);
  assert.equal(chatHeaderModel(snapshot(), false).liveLabel, "Offline: not connected to FluxIQ");
  assert.equal(chatHeaderModel(snapshot({ state: relayState([], { live: false }) }), true).liveLabel, "Offline: FluxIQ is not streaming activity");
  assert.equal(chatHeaderModel(snapshot({ reach: "unsupported" }), true).liveLabel, "Offline: this extension build has no live activity");
  assert.equal(chatHeaderModel(snapshot({ reach: "failed", readError: "The extension restarted." }), true).liveLabel, "Offline: The extension restarted.");
  assert.equal(chatHeaderModel(snapshot({ reach: "loading" }), true).liveLabel, "Connecting");
});

test("the overlay control shows the preference, and is off until the relay answers or while a change is saving", () => {
  const model = chatHeaderModel(snapshot({ state: relayState([], { overlay: "collapsed" }) }), true);
  assert.deepEqual(model.overlay.options.map((option) => [option.value, option.label, option.selected]), [
    ["expanded", "Full", false],
    ["collapsed", "Small", true],
    ["hidden", "Off", false]
  ]);
  assert.equal(model.overlay.disabled, false);
  for (const reach of ["loading", "failed", "unsupported"] as const) assert.equal(chatHeaderModel(snapshot({ reach }), true).overlay.disabled, true, reach);
  assert.equal(chatHeaderModel(snapshot({ overlaySaving: true }), true).overlay.disabled, true);
  assert.equal(chatHeaderModel(snapshot({ overlayError: "Couldn't." }), true).overlay.error, "Couldn't.");
});
