// A journey's checkpoints: stage, elapsed time and closed facts.

import assert from "node:assert/strict";
import test from "node:test";
import { journeyTimeline } from "../timeline.js";

test("each mark records the stage, its facts and the time since the journey began", () => {
  let now = 1_000;
  const timeline = journeyTimeline(() => now);
  now = 1_250;
  timeline.mark("flow-provisioned");
  now = 2_000;
  timeline.mark("records-judged", { matchedRecords: 8, sessionReset: false });
  assert.deepEqual(timeline.checkpoints, [
    { stage: "flow-provisioned", elapsedMs: 250 },
    { matchedRecords: 8, sessionReset: false, stage: "records-judged", elapsedMs: 1_000 },
  ]);
  assert.equal(timeline.elapsedMs(), 1_000);
});

test("a fact cannot overwrite the stage or its time", () => {
  const timeline = journeyTimeline(() => 5);
  timeline.mark("real-stage", { stage: "forged", elapsedMs: 99 });
  assert.deepEqual(timeline.checkpoints[0], { stage: "real-stage", elapsedMs: 0 });
});
