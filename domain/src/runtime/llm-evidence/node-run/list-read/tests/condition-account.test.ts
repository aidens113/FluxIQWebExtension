// What each `where` condition of a list read kept, made from the read's own
// summary for its draft statement (`../condition-account.ts`, t693). The
// examples are a library catalogue's, not a store's.

import assert from "node:assert/strict";
import test from "node:test";
import { webListReadConditionAccount } from "..";

const EXTRACT = "web.output.dom-extract_list";
const SUMMARY = { recordCount: 9, pagesRead: 1, truncated: false, fieldNames: ["title", "status"], missingFields: [] };

test("each condition's kept count is the items asked about less the ones it rejected, with the values it read on kept rows", () => {
  const extraction = { ...SUMMARY, conditions: { applied: 12, kept: 9, rejected: [0, 3], unfiltered: false, keptValues: [["On loan", "Available"], []] } };
  assert.deepEqual(webListReadConditionAccount(EXTRACT, { extraction }), [
    { kept: 12, rejected: 0, keptValues: ["On loan", "Available"] },
    { kept: 9, rejected: 3, keptValues: [] }
  ]);
  // A page build that predates the values still says the counts.
  const older = { ...SUMMARY, conditions: { applied: 12, kept: 9, rejected: [0, 3], unfiltered: false } };
  assert.deepEqual(webListReadConditionAccount(EXTRACT, { extraction: older })?.map((entry) => entry.keptValues), [[], []]);
});

test("says nothing for another node, a read with no conditions, or a malformed summary", () => {
  const extraction = { ...SUMMARY, conditions: { applied: 12, kept: 12, rejected: [0], unfiltered: false } };
  assert.equal(webListReadConditionAccount("web.output.dom-click", { extraction }), undefined);
  assert.equal(webListReadConditionAccount(EXTRACT, { extraction: SUMMARY }), undefined);
  assert.equal(webListReadConditionAccount(EXTRACT, { extraction: { ...extraction, conditions: { ...extraction.conditions, keptValues: [["a", "b", "c", "d"]] } } }), undefined);
  assert.equal(webListReadConditionAccount(EXTRACT, undefined), undefined);
});
