import assert from "node:assert/strict";
import test from "node:test";

import { ActivityLog } from "../connection/index";
import { RECORDED_STEP_INDEX_LIMIT, RecordedStepIndex } from "../recorded-steps";

test("a step is found by its activity id until it is forgotten", () => {
  const index = new RecordedStepIndex();
  index.note("a1", { recordingId: "r1", eventId: "web.1.1" });
  assert.deepEqual(index.lookup("a1"), { recordingId: "r1", eventId: "web.1.1" });
  index.forget("a1");
  assert.equal(index.lookup("a1"), undefined);
});

test("the index keeps only the newest steps", () => {
  const index = new RecordedStepIndex();
  for (let step = 0; step <= RECORDED_STEP_INDEX_LIMIT; step += 1) index.note(`a${step}`, { recordingId: "r", eventId: `e${step}` });
  assert.equal(index.lookup("a0"), undefined);
  assert.ok(index.lookup(`a${RECORDED_STEP_INDEX_LIMIT}`));
});

test("the activity log answers the id it recorded and removes an entry from both lists", () => {
  const log = new ActivityLog();
  const id = log.record("dom.click", "Click");
  log.record("dom.input", "Type");
  assert.equal(log.remove(id), true);
  assert.deepEqual(log.recentEntries().map((entry) => entry.label), ["Type"]);
  assert.deepEqual(log.page(1, 25).items.map((entry) => entry.label), ["Type"]);
  assert.equal(log.remove(id), false);
});
