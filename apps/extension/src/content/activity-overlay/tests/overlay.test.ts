// Coverage of overlay.ts: a display older than the one drawn for the same unit
// of work -- a paced send overtaken by the at-once answer to a new document --
// is not drawn over the newer one.

import assert from "node:assert/strict";
import test from "node:test";

import { ACTIVITY_MESSAGES, type ActivityContentMessage, type ActivityDisplay } from "../../../shared/activity";
import { showActivityOverlay } from "../overlay";
import { withFakeDom, type FakeNode } from "./fake-dom";

function message(sequence: number, detail: string, activityId = "build:b1"): ActivityContentMessage {
  const display: ActivityDisplay = {
    activityId,
    subjectKind: "build",
    phase: "thinking",
    headline: "Building your Flow",
    detail,
    step: null,
    working: true,
    outcome: null,
    sequence
  };
  return { type: ACTIVITY_MESSAGES.content, activity: null, display, overlay: "expanded", topFrameOnly: true };
}

test("an older display of the same work is ignored; a new unit of work or a take-down always applies", () => {
  withFakeDom((dom) => {
    const text = () => (dom.documentElement.children[0] as FakeNode | undefined)?.shadow?.textContent ?? "";
    showActivityOverlay(message(5, "Newer sentence"));
    showActivityOverlay(message(3, "Older sentence"));
    assert.ok(text().includes("Newer sentence"));
    showActivityOverlay(message(1, "A new build", "build:b2"));
    assert.ok(text().includes("A new build"));
    showActivityOverlay({ ...message(1, ""), display: null });
    assert.equal(dom.documentElement.children.length, 0);
  });
});
