// A Flow's spend as Core published it: the largest call input and the role
// tallies are read as Core kept them, `null` where it kept none, and a
// malformed figure is refused rather than coerced.

import assert from "node:assert/strict";
import test from "node:test";
import { flowSpendReading } from "../flow-spend.js";

const ITEM = { calls: 1, usd: 0.001 };
const BY_PHASE = { build: ITEM, read: ITEM, judge: ITEM, runtime: ITEM, reauthor: ITEM, chat: ITEM };
const ITEMISED = { projectId: "project.web", flowId: "flow.main", spentUsd: 0.006, builds: 1, calls: 6, byPhase: BY_PHASE, createdAt: 1, updatedAt: 2 };

test("reads the largest input and the role tallies of an itemised record", () => {
  const read = flowSpendReading({ ...ITEMISED, largestInputTokens: 21_000, byRole: { supervisor: { calls: 1, usd: 0.002 }, builder: { calls: 3, usd: 0.003 } } });
  assert.equal(read?.largestInputTokens, 21_000);
  assert.deepEqual(read?.byRole, { supervisor: { calls: 1, usd: 0.002 }, builder: { calls: 3, usd: 0.003 } });
  assert.deepEqual(flowSpendReading({ ...ITEMISED, largestInputTokens: null, byRole: {} })?.byRole, {});
});

test("reads both as null from a Core or a record that does not keep them", () => {
  const older = flowSpendReading(ITEMISED);
  assert.deepEqual([older?.largestInputTokens, older?.byRole], [null, null]);
  const unitemised = flowSpendReading({ ...ITEMISED, calls: null, byPhase: null, largestInputTokens: null, byRole: null });
  assert.deepEqual([unitemised?.largestInputTokens, unitemised?.byRole], [null, null]);
});

test("refuses a malformed largest input or role tally", () => {
  assert.throws(() => flowSpendReading({ ...ITEMISED, largestInputTokens: 1.5 }), /largestInputTokens must be a non-negative integer/u);
  assert.throws(() => flowSpendReading({ ...ITEMISED, byRole: { "Builder 1": ITEM } }), /byRole has a key that is not a role name/u);
  assert.throws(() => flowSpendReading({ ...ITEMISED, byRole: { builder: { calls: 1, usd: -1 } } }), /byRole\.builder\.usd must not be negative/u);
  assert.throws(() => flowSpendReading({ ...ITEMISED, calls: null, byPhase: null, largestInputTokens: 10 }), /need an itemised record/u);
});
