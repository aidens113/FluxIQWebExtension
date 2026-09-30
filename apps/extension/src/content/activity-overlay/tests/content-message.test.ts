// Reading the background's activity message: the wire name is the shared
// constant, the paced `display` is read and checked, and a malformed message
// is not mistaken for one.

import assert from "node:assert/strict";
import test from "node:test";
import { ACTIVITY_MESSAGES, type ActivityDisplay } from "../../../shared/activity";
import { activityContentMessage } from "../content-message";

const activity = {
  activityId: "build:build-1",
  sequence: 1,
  subject: { kind: "build", id: "build-1", projectId: "p" },
  phase: "thinking",
  label: "Deciding the next step",
  at: "2026-09-29T10:00:00.000Z"
};

const display: ActivityDisplay = {
  activityId: "build:build-1",
  subjectKind: "build",
  phase: "thinking",
  headline: "Building your Flow",
  detail: "Deciding the next step",
  step: null,
  working: true,
  outcome: null,
  sequence: 1
};

test("a well-formed message is read with its display, whatever else rides with it", () => {
  const read = activityContentMessage({ type: ACTIVITY_MESSAGES.content, activity, display, overlay: "collapsed", topFrameOnly: true, extra: 1 });
  assert.deepEqual(read, { type: "fluxiq.activity.overlay", activity, display, overlay: "collapsed", topFrameOnly: true });
});

test("a display with a step and a settled one are read", () => {
  const running = { ...display, subjectKind: "run", activityId: "run:r", headline: "Running your Flow", step: { index: 2, count: 5 } };
  assert.deepEqual(activityContentMessage({ type: ACTIVITY_MESSAGES.content, activity: null, display: running, overlay: "expanded" })?.display, running);
  const settled = { ...display, working: false, outcome: "failed", headline: "Build failed", detail: null };
  assert.deepEqual(activityContentMessage({ type: ACTIVITY_MESSAGES.content, activity: null, display: settled, overlay: "expanded" })?.display, settled);
});

test("no display is a message too: it takes the overlay down", () => {
  const read = activityContentMessage({ type: ACTIVITY_MESSAGES.content, activity: null, display: null, overlay: "expanded" });
  assert.equal(read?.display, null);
  assert.equal(read?.activity, null);
  assert.equal(activityContentMessage({ type: ACTIVITY_MESSAGES.content, overlay: "expanded" })?.display, null);
});

test("other messages and malformed ones are not activity messages", () => {
  const content = ACTIVITY_MESSAGES.content;
  assert.equal(activityContentMessage(undefined), undefined);
  assert.equal(activityContentMessage("fluxiq.activity.overlay"), undefined);
  assert.equal(activityContentMessage({ type: "fluxiq.ping" }), undefined);
  assert.equal(activityContentMessage({ type: content, activity, display, overlay: "floating" }), undefined);
  assert.equal(activityContentMessage({ type: content, activity: { phase: "running" }, display, overlay: "expanded" }), undefined);
  assert.equal(activityContentMessage({ type: content, activity: "running", display, overlay: "expanded" }), undefined);
  for (const broken of [
    "Building your Flow",
    { ...display, headline: undefined },
    { ...display, subjectKind: "flow" },
    { ...display, detail: 3 },
    { ...display, step: { index: "2", count: 5 } },
    { ...display, working: "yes" },
    { ...display, outcome: "maybe" },
    { ...display, sequence: undefined }
  ]) {
    assert.equal(activityContentMessage({ type: content, activity, display: broken, overlay: "expanded" }), undefined, JSON.stringify(broken));
  }
});
