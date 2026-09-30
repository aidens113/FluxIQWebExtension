// The latest chat shows all of FluxIQ's live activity; an automation's chat
// shows only the work on that automation, and its live line only while that
// work is what the paced display describes.

import assert from "node:assert/strict";
import test from "node:test";
import type { ActivityDisplay } from "../../../../shared/activity/index";
import { activityEvent, relayState } from "../../tests/activity-fixture";
import { activityForTarget } from "../target-activity";

const AUTOMATION = { kind: "automation", flowId: "flow-7", name: "Price tracker" } as const;

function display(activityId: string): ActivityDisplay {
  return { activityId, subjectKind: "run", phase: "running", headline: "Running your Flow", detail: null, step: null, working: true, outcome: null, sequence: 3 };
}

const ours = activityEvent(1, { activityId: "run:r1", subject: { kind: "run", id: "r1", projectId: "p", flowId: "flow-7" } });
const theirs = activityEvent(2, { activityId: "run:r2", subject: { kind: "run", id: "r2", projectId: "p", flowId: "flow-8" } });
const spoken = activityEvent(3, { activityId: "build:b1", subject: { kind: "build", id: "b1", projectId: "p" }, conversationId: "conv-flow" });

test("the latest chat shows everything", () => {
  const state = relayState([ours, theirs, spoken], { display: display("run:r2") });
  const shown = activityForTarget(state, { kind: "latest" }, undefined);
  assert.equal(shown.recent.length, 3);
  assert.equal(shown.display?.activityId, "run:r2");
});

test("an automation's chat shows its own Flow's work and what speaks through its thread", () => {
  const state = relayState([ours, theirs, spoken], { display: display("run:r1") });
  const shown = activityForTarget(state, AUTOMATION, "conv-flow");
  assert.deepEqual(shown.recent.map((event) => event.activityId), ["run:r1", "build:b1"]);
  assert.equal(shown.display?.activityId, "run:r1");
  assert.deepEqual(activityForTarget(state, AUTOMATION, undefined).recent.map((event) => event.activityId), ["run:r1"]);
});

test("another automation's work never moves this chat's live line", () => {
  const state = relayState([ours, theirs], { display: display("run:r2") });
  assert.equal(activityForTarget(state, AUTOMATION, undefined).display, null);
});

test("work that speaks through another thread never shows in this one, in either chat", () => {
  const otherThread = activityEvent(4, { activityId: "build:b9", subject: { kind: "build", id: "b9", projectId: "p", flowId: "flow-7" }, conversationId: "conv-other" });
  const earlier = activityEvent(3, { activityId: "build:b9", subject: { kind: "build", id: "b9", projectId: "p", flowId: "flow-7" } });
  const state = relayState([ours, earlier, otherThread], { display: display("build:b9") });
  const latest = activityForTarget(state, { kind: "latest" }, "conv-latest");
  assert.deepEqual(latest.recent.map((event) => event.activityId), ["run:r1"]);
  assert.equal(latest.display, null, "the live line does not describe another thread's work");
  assert.deepEqual(activityForTarget(state, AUTOMATION, "conv-flow").recent.map((event) => event.activityId), ["run:r1"]);
  assert.equal(activityForTarget(state, { kind: "latest" }, undefined).recent.length, 3, "with no thread yet, nothing is anyone else's");
});
