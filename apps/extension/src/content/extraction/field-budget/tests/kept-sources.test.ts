// T1 coverage of the proposal's field budget: a few places for partial
// controls, then a few for partial marks, then coverage, within the bound.

import assert from "node:assert/strict";
import test from "node:test";
import { keptSources } from "../kept-sources";

type Entry = { source: { pressable?: true; selector: string }; position: number; coverage: number };

function entries(count: number, coverage: number, from: number, pressable = false): Entry[] {
  return Array.from({ length: count }, (_, index) => ({
    source: { selector: `s${from + index}`, ...(pressable ? { pressable: true as const } : {}) },
    position: from + index,
    coverage
  }));
}

test("everything is kept, in document order, when the run offers no more than the bound", () => {
  const measured = [...entries(3, 0.5, 0), ...entries(3, 1, 3)];
  assert.deepEqual(keptSources(measured).map((entry) => entry.position), [0, 1, 2, 3, 4, 5]);
});

test("a partial control few rows carry is kept past a bound full of wider columns", () => {
  const wide = [...entries(60, 1, 0), ...entries(20, 0.5, 60)];
  const control = entries(1, 0.1, 80, true);
  const kept = keptSources([...wide, ...control]);
  assert.equal(kept.length, 64);
  assert.ok(kept.some((entry) => entry.position === 80));
  // The marks keep their own places too, and coverage spends the rest.
  assert.equal(kept.filter((entry) => entry.coverage === 0.5).length, 8);
  assert.equal(kept.filter((entry) => entry.coverage === 1).length, 55);
});

test("at most four partial controls take reserved places; any more compete as marks and by coverage", () => {
  const controls = entries(6, 0.1, 0, true);
  const wide = entries(70, 1, 6);
  const kept = keptSources([...controls, ...wide]);
  assert.equal(kept.length, 64);
  // Four reserved as controls, two more as partial marks, the rest by coverage.
  assert.equal(kept.filter((entry) => entry.source.pressable === true).length, 6);
  const many = keptSources([...entries(12, 0.1, 0, true), ...wide]);
  assert.equal(many.filter((entry) => entry.source.pressable === true).length, 12);
  assert.equal(many.length, 64);
});

test("a control every row carries is not a partial column and is kept by coverage like any other", () => {
  const kept = keptSources([...entries(70, 1, 0), ...entries(1, 1, 70, true)]);
  assert.equal(kept.length, 64);
  assert.equal(kept.some((entry) => entry.position === 70), false);
});
