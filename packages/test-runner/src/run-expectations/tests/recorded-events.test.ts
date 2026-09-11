import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { assertRecordedEvents } from "../recorded-events.js";

const fastClock = () => { let now = 0; return { now: () => now, sleep: async (milliseconds: number) => { now += milliseconds; } }; };
const reads = (...tallies: Array<Record<string, number>>) => { let index = 0; return async () => tallies[Math.min(index++, tallies.length - 1)]!; };

test("maps recorded kinds to event types; a listed count is exact, an unlisted count means at least one", async () => {
  const counts = await assertRecordedEvents(reads({ "dom.input": 2, "dom.change": 1, "dom.click": 1, "evidence:dom.mutation": 4 }), [
    { type: "web.element.input_changed", count: 2 }, { type: "web.element.changed", count: 1 }, { type: "web.element.clicked" },
  ], fastClock());
  assert.deepEqual(counts, { "web.element.input_changed": 2, "web.element.changed": 1, "web.element.clicked": 1, "web.dom.mutated": 4 });
});

test("evidence entries count toward their event type, since the extension recorded them", async () => {
  const counts = await assertRecordedEvents(reads({ "dom.click": 1, "evidence:dom.click": 1 }), [{ type: "web.element.clicked", count: 2 }], fastClock());
  assert.equal(counts["web.element.clicked"], 2);
});

test("waits for events still travelling from the page", async () => {
  const counts = await assertRecordedEvents(reads({ "dom.click": 1 }, { "dom.click": 2 }), [{ type: "web.element.clicked", count: 2 }], fastClock());
  assert.equal(counts["web.element.clicked"], 2);
});

test("fails as a recording contract error naming each mismatch, including too many events", async () => {
  await assert.rejects(assertRecordedEvents(reads({ "dom.change": 2 }), [{ type: "web.element.changed", count: 1 }, { type: "web.element.clicked" }], fastClock()), (error: unknown) => {
    assert.ok(error instanceof RunnerFailure);
    assert.equal(error.category, "recording.contract");
    assert.deepEqual(error.details?.mismatches, [{ type: "web.element.changed", expected: 1, actual: 2 }, { type: "web.element.clicked", expected: "at least 1", actual: 0 }]);
    assert.deepEqual(error.details?.extensionRecorded, { "dom.change": 2 });
    return true;
  });
});

test("nothing expected reads nothing", async () => {
  let calls = 0;
  assert.deepEqual(await assertRecordedEvents(async () => { calls += 1; return {}; }, []), {});
  assert.equal(calls, 0);
});
