import assert from "node:assert/strict";
import test from "node:test";
import { PRESS_WORK_EVENTS } from "../../../../shared/press-work-event";
import { markPressWork } from "../work-mark";

test("an unsupported or not-yet-observed click is unknown; pending and idle require a fresh supported observation", () => {
  const state = { observed: false, pending: true, releases: 0 };
  const mark = markPressWork({ dispatchEvent(event) {
    if (event.type === PRESS_WORK_EVENTS.mark) return false;
    if (event.type === PRESS_WORK_EVENTS.observed) return !state.observed;
    if (event.type === PRESS_WORK_EVENTS.pending) return !state.pending;
    if (event.type === PRESS_WORK_EVENTS.release) state.releases += 1;
    return true;
  } });
  assert.ok(mark);
  assert.equal(mark.state(), "unknown");
  state.observed = true;
  assert.equal(mark.state(), "pending");
  state.pending = false;
  assert.equal(mark.state(), "idle");
  state.observed = false;
  assert.equal(mark.state(), "unknown", "lost coverage is not an idle mark");
  mark.stop();
  mark.stop();
  assert.equal(state.releases, 1);
  assert.equal(mark.state(), "unknown");
});

test("an absent work observer provides no mark and no positive settlement", () => {
  assert.equal(markPressWork({ dispatchEvent: () => true }), undefined);
});
