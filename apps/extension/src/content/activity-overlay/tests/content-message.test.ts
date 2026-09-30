// Reading the background's activity message: the wire name is the shared
// constant, and a malformed message is not mistaken for one.

import assert from "node:assert/strict";
import test from "node:test";
import { ACTIVITY_MESSAGES } from "../../../shared/activity";
import { activityContentMessage } from "../content-message";

const activity = {
  activityId: "build-1",
  sequence: 1,
  subject: { kind: "build", id: "build-1", projectId: "p" },
  phase: "thinking",
  label: "Deciding what to look at next",
  at: "2026-09-29T10:00:00.000Z"
};

test("a well-formed message is read, whatever else rides with it", () => {
  const read = activityContentMessage({ type: ACTIVITY_MESSAGES.content, activity, overlay: "collapsed", topFrameOnly: true, extra: 1 });
  assert.deepEqual(read, { type: "fluxiq.activity.overlay", activity, overlay: "collapsed", topFrameOnly: true });
});

test("no activity is a message too: it takes the overlay down", () => {
  assert.deepEqual(activityContentMessage({ type: ACTIVITY_MESSAGES.content, activity: null, overlay: "expanded" })?.activity, null);
  assert.deepEqual(activityContentMessage({ type: ACTIVITY_MESSAGES.content, overlay: "expanded" })?.activity, null);
});

test("other messages and malformed ones are not activity messages", () => {
  assert.equal(activityContentMessage(undefined), undefined);
  assert.equal(activityContentMessage("fluxiq.activity.overlay"), undefined);
  assert.equal(activityContentMessage({ type: "fluxiq.ping" }), undefined);
  assert.equal(activityContentMessage({ type: ACTIVITY_MESSAGES.content, activity, overlay: "floating" }), undefined);
  assert.equal(activityContentMessage({ type: ACTIVITY_MESSAGES.content, activity: { phase: "running" }, overlay: "expanded" }), undefined);
  assert.equal(activityContentMessage({ type: ACTIVITY_MESSAGES.content, activity: "running", overlay: "expanded" }), undefined);
});
