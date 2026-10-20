import assert from "node:assert/strict";
import test from "node:test";
import type { ExpectedExtraction } from "@fluxiq-web-extension/test-contracts";
import { tier1Derivability } from "../tier1-derivability.js";

const entry: ExpectedExtraction = {
  step: "read", count: 2,
  records: [
    { group: "G1", author: "A1", text: "T1" },
    { group: "G2", author: "A2", text: "T2" },
  ],
} as ExpectedExtraction;

test("derivable when every required column is stored and every expected record is among the stored rows", () => {
  const rows = [{ group: "G0", author: "A0", text: "T0" }, { group: "G2", author: "A2", text: "T2" }, { group: "G1", author: "A1", text: "T1" }];
  const verdict = tier1Derivability(rows, entry);
  assert.equal(verdict.derivable, true);
  assert.equal(verdict.coveredOnSharedColumns, 2);
  assert.deepEqual(verdict.reasons, []);
});

test("not derivable when a column was never stored, nor when a stored column holds another column's values", () => {
  // The read bound `group` to the author's element and never read `text`: the round-4 social shape.
  const rows = [{ group: "A1", author: "3h", text: null }, { group: "A2", author: "5h", text: null }, { group: "A9", author: "1d", text: null }];
  const verdict = tier1Derivability(rows, entry);
  assert.equal(verdict.derivable, false);
  assert.deepEqual(verdict.missingColumns, ["text"]);
  assert.deepEqual(verdict.columnsHoldingOther, [{ stored: "group", holds: "author", expectedRecords: 2 }]);
  assert.equal(verdict.coveredOnSharedColumns, 0);
  assert.equal(verdict.reasons.length, 3);
  assert.ok(verdict.reasons.every((reason) => !/A1|A2|T1|T2|G1|G2/.test(reason)), "reasons name columns and counts, never a value");
});

test("an expectation listing no records can never be shown derivable", () => {
  const verdict = tier1Derivability([{ a: "1" }], { step: "read", count: 1 } as ExpectedExtraction);
  assert.equal(verdict.derivable, false);
  assert.match(verdict.reasons[0]!, /lists no records/);
});
