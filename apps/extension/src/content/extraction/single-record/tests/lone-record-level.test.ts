// T1 coverage of which level around a target is its one record, on level
// descriptors transcribed from the scenarios (moon-jar audit fix spec A,
// `docs/working/language-driven-flow-loop-plan/reports/t195-w19e-audit-moon-jar.md`).
// Measuring the levels needs a document (`lone-record.ts`).
//
// The photo-social reply card is
// `<a class=card2><img alt><div><span>name</span><span>€68.00</span><span class=meta>note</span></div></a>`
// (`apps/scenario-lab/src/scenarios/photo-social/pages/direct.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import { chooseLoneRecordLevel, type LoneRecordLevel } from "../lone-record-level";

function level(contentFields: number, overrides: Partial<LoneRecordLevel> = {}): LoneRecordLevel {
  return { cell: false, boundary: false, contentFields, holdsRun: false, namedExactly: true, ...overrides };
}

test("aimed at the card's price, the record is the block holding its name, price and note", () => {
  // span (no values of its own), the card's text block (three spans), the card (its image and the block).
  assert.equal(chooseLoneRecordLevel([level(0), level(3), level(5)]), 1);
});

test("aimed at the card itself, the card is the record", () => {
  assert.equal(chooseLoneRecordLevel([level(5)]), 0);
});

test("aimed at a cart's heading, the section holding the cart's lines stops the walk with no record", () => {
  // h2, the header holding the heading and the subtotal's label, the section holding the lines.
  assert.equal(chooseLoneRecordLevel([level(0), level(1), level(4, { holdsRun: true })]), undefined);
});

test("a boundary before any level holding two values ends the walk with no record", () => {
  assert.equal(chooseLoneRecordLevel([level(0), level(1), level(0, { boundary: true }), level(6)]), undefined);
  assert.equal(chooseLoneRecordLevel([level(0), level(1)]), undefined, "a walk that runs out has none either");
});

test("a table cell is passed over, and its row may be the record", () => {
  assert.equal(chooseLoneRecordLevel([level(0), level(2, { cell: true }), level(4)]), 2);
});

test("a level no selector names on its own is passed over", () => {
  assert.equal(chooseLoneRecordLevel([level(0), level(3, { namedExactly: false }), level(5)]), 2);
});

test("the levels are asked for only as far as the answer", () => {
  let asked = 0;
  function* levels(): Generator<LoneRecordLevel> {
    for (const described of [level(0), level(3), level(5)]) {
      asked += 1;
      yield described;
    }
  }
  assert.equal(chooseLoneRecordLevel(levels()), 1);
  assert.equal(asked, 2);
});
