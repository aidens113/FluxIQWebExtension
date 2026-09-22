// The extraction journey's verdict: the stored rows against the record
// oracle, by matched records, and the digest the restart journey compares.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { RunnerFailure } from "../../../failure.js";
import { assertDatasetJudgement, datasetDigest, datasetJudgementFailure, judgeStoredDataset } from "../dataset-judgement.js";

const ORIGIN = "http://127.0.0.1:41234";
const entry = { step: "extract-page-one", count: 2, records: [{ name: "Desk lamp", url: "/p/desk" }, { name: "Floor lamp", url: "/p/floor" }] };
const stored = (records: Array<Record<string, string | null>>, extra: Partial<{ nonStringValues: number; storeTruncated: boolean; invalidCount: number }> = {}) => ({
  datasetId: "extracted-data:one", nodeIds: ["node.one"], recordCount: records.length, storeTruncated: false, invalidCount: 0,
  records, nonStringValues: 0, pages: 1, fieldCount: 2, ...extra,
});

test("a dataset whose every record matches at its position passes, with same-origin absolute links", () => {
  const judged = judgeStoredDataset(stored([{ name: "Desk lamp", url: `${ORIGIN}/p/desk` }, { name: "Floor lamp", url: `${ORIGIN}/p/floor` }]), entry, { scenarioOrigin: ORIGIN });
  assert.equal(judged.matchedRecords, 2);
  assert.equal(judged.expectedRecords, 2);
  assert.equal(datasetJudgementFailure(judged), undefined);
  assert.doesNotThrow(() => assertDatasetJudgement(judged));
});

test("the right rows in the wrong order, too many rows, a non-text value, or a store that dropped rows each fail with their own code", () => {
  const context = { scenarioOrigin: ORIGIN };
  const swapped = judgeStoredDataset(stored([{ name: "Floor lamp", url: "/p/floor" }, { name: "Desk lamp", url: "/p/desk" }]), entry, context);
  assert.equal(swapped.matchedRecords, 0);
  assert.equal(swapped.matchedInAnyOrder, 2);
  assert.equal(datasetJudgementFailure(swapped), "extraction.records_mismatch");
  const extra = judgeStoredDataset(stored([...entry.records, { name: "Extra", url: "/p/extra" }]), entry, context);
  assert.equal(extra.matchedRecords, 2);
  assert.equal(datasetJudgementFailure(extra), "extraction.record_count_mismatch");
  assert.equal(datasetJudgementFailure(judgeStoredDataset(stored(entry.records, { nonStringValues: 1 }), entry, context)), "extraction.non_string_values");
  assert.equal(datasetJudgementFailure(judgeStoredDataset(stored(entry.records, { storeTruncated: true }), entry, context)), "extraction.store_incomplete");
});

test("a failed judgement carries counts and never a stored value or the digest", () => {
  const judged = judgeStoredDataset(stored([{ name: "Secret shelf", url: "/p/secret" }, { name: "Floor lamp", url: "/p/floor" }]), entry, { scenarioOrigin: ORIGIN });
  assert.throws(() => assertDatasetJudgement(judged), (error: unknown) => {
    assert.ok(error instanceof RunnerFailure);
    assert.equal(error.details?.reasonCode, "extraction.records_mismatch");
    assert.equal(error.details?.matchedRecords, 1);
    const serialized = JSON.stringify({ message: error.message, details: error.details });
    assert.doesNotMatch(serialized, /Secret shelf|Floor lamp|\/p\//u);
    assert.equal(serialized.includes(judged.sha256), false);
    return true;
  });
});

test("the digest is lab replay's: rows in order, each record's keys sorted, SHA-256 of the JSON", () => {
  const rows = [{ url: "/p/desk", name: "Desk lamp" }, { name: "Floor lamp", url: null }];
  const canonical = JSON.stringify([{ name: "Desk lamp", url: "/p/desk" }, { name: "Floor lamp", url: null }]);
  assert.equal(datasetDigest(rows), createHash("sha256").update(canonical, "utf8").digest("hex"));
  assert.equal(datasetDigest([{ name: "a", url: "b" }]), datasetDigest([{ url: "b", name: "a" }]));
  assert.notEqual(datasetDigest(rows), datasetDigest([...rows].reverse()));
});
