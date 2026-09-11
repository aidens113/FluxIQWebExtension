// T1 coverage of event-sequence.ts: ids for events the background worker
// originates stay distinct when several share a millisecond.

import assert from "node:assert/strict";
import { test } from "node:test";
import { EventSequence } from "../event-sequence";

test("events in one millisecond get distinct, increasing numbers that keep increasing across milliseconds", (t) => {
  let now = 1_757_548_800_000;
  t.mock.method(Date, "now", () => now);
  const sequence = new EventSequence();
  assert.deepEqual([sequence.next(), sequence.next(), sequence.next()], [1_757_548_800_000_001, 1_757_548_800_000_002, 1_757_548_800_000_003]);
  now += 1;
  const next = sequence.next();
  assert.equal(next, 1_757_548_800_001_004);
  assert.ok(Number.isSafeInteger(next));
});

test("a thousand events in one millisecond are all distinct", (t) => {
  t.mock.method(Date, "now", () => 1_757_548_800_000);
  const sequence = new EventSequence();
  assert.equal(new Set(Array.from({ length: 1_000 }, () => sequence.next())).size, 1_000);
});
