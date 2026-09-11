import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { assertExtraction } from "../extraction.js";

const records = [{ name: "Kettle", price: "$25.00" }, { name: "Lamp", price: "$40.00" }];

test("count is exact and records are the complete list in order; both must hold when both are given", () => {
  assert.doesNotThrow(() => assertExtraction([{ step: "read", count: 2, records }], "read", records));
  assert.throws(() => assertExtraction([{ step: "read", count: 3 }], "read", records), /yielded 2 record\(s\), expected 3/);
  assert.throws(() => assertExtraction([{ step: "read", records: records.slice(0, 1) }], "read", records), /expected the 1 listed/);
  assert.throws(() => assertExtraction([{ step: "read", records: [...records].reverse() }], "read", records), /record 0 does not match/);
  assert.throws(() => assertExtraction([{ step: "read", count: 2, records: [records[0]!, { name: "Lamp", price: "$41.00" }] }], "read", records), (error: unknown) => {
    assert.ok(error instanceof RunnerFailure);
    assert.equal(error.details?.index, 1);
    return true;
  });
});

test("a record with a missing or extra field does not match", () => {
  assert.throws(() => assertExtraction([{ step: "read", records: [{ name: "Kettle" }, { name: "Lamp", price: "$40.00" }] }], "read", records), /record 0/);
  assert.throws(() => assertExtraction([{ step: "read", records: [{ name: "Kettle", price: "$25.00", rating: "4" }, records[1]!] }], "read", records), /record 0/);
});

test("only entries naming this step apply, and no entries means nothing to assert", () => {
  assert.doesNotThrow(() => assertExtraction([{ step: "other", count: 9 }], "read", records));
  assert.doesNotThrow(() => assertExtraction(undefined, "read", []));
});
