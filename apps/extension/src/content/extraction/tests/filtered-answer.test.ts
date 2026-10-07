// A filtered read answers with too much rather than with nothing (C5).
//
// The rows below are the rule that `run-mug3tnti-9ab80b85` was missing: it
// returned 0 records where 13 were wanted, from conditions that were close but
// rejected every row, and nothing distinguished that from a page with nothing on
// it. The run before returned 55 unfiltered and the run after returned 10 with 7
// right, so what was missing was a floor rather than the capability.

import assert from "node:assert/strict";
import test from "node:test";
import { filteredListAnswer } from "../filtered-answer";
import type { ExtractedListRecord } from "../list-reader";

const KEPT: ExtractedListRecord[] = [{ name: "Acme Earbuds", price: "$39.00" }];
const REJECTED: ExtractedListRecord[] = [
  { name: "Acme Charging Case", price: "$19.00" },
  { name: "Acme Ear Tips", price: "$9.00" }
];

function rows(over: Partial<Parameters<typeof filteredListAnswer>[0]> = {}) {
  return {
    kept: [],
    keptMissing: new Set<string>(),
    rejected: [],
    rejectedMissing: new Set<string>(),
    rejectedTruncated: false,
    ...over
  };
}

test("a read that kept anything answers with what it kept, and never with what it rejected", () => {
  const answer = filteredListAnswer(rows({ kept: KEPT, rejected: REJECTED }), false);
  assert.deepEqual(answer.records, KEPT);
  assert.equal(answer.unfiltered, false);
  // A rejected row's missing required field stays unreported while it is being
  // left out: the request never asked to read it.
  const withMissing = filteredListAnswer(rows({ kept: KEPT, keptMissing: new Set(["url"]), rejected: REJECTED, rejectedMissing: new Set(["rating"]) }), false);
  assert.deepEqual(withMissing.missingFields, ["url"]);
});

test("a read whose conditions kept nothing answers with the rows they rejected, and says so", () => {
  const answer = filteredListAnswer(rows({ rejected: REJECTED }), false);
  assert.deepEqual(answer.records, REJECTED);
  assert.equal(answer.unfiltered, true);
  // A row being returned is a row whose absent required field is worth
  // reporting, so the validation cannot pass on rows it knows are incomplete.
  const withMissing = filteredListAnswer(rows({ rejected: REJECTED, rejectedMissing: new Set(["rating"]), keptMissing: new Set(["url"]) }), false);
  assert.deepEqual(withMissing.missingFields, ["rating", "url"]);
  // And the bound that stopped the rejected rows being kept aside now matters,
  // because they are the answer.
  assert.equal(filteredListAnswer(rows({ rejected: REJECTED, rejectedTruncated: true }), false).truncated, true);
  assert.equal(filteredListAnswer(rows({ kept: KEPT, rejected: REJECTED, rejectedTruncated: true }), false).truncated, false);
});

test("a page that really held nothing is still an empty answer, and is not called unfiltered", () => {
  // No rows read at all: there is nothing to fall back to and nothing was
  // filtered away, so the answer is empty and honest. The same holds for a read
  // continued from another document, which carries its predecessor's counts but
  // not its rejected rows -- claiming `unfiltered` there would be a claim about
  // rows that are not present.
  const answer = filteredListAnswer(rows(), false);
  assert.deepEqual(answer.records, []);
  assert.equal(answer.unfiltered, false);
  assert.equal(answer.truncated, false);
});

test("truncation from the kept rows is carried whichever rows answer", () => {
  assert.equal(filteredListAnswer(rows({ kept: KEPT }), true).truncated, true);
  assert.equal(filteredListAnswer(rows({ rejected: REJECTED }), true).truncated, true);
});

// A Flow's read reads one page (S5, contract C3): the domain sends
// `answer: "kept"`, and the floor above moves to the collection. A page whose
// items all fail the conditions is a page with nothing to collect, not a page to
// answer with what it rejected -- the rejected rows would be stored as if they
// matched, and a later page's kept rows would sit beside them.

test("a read that answers what it kept answers nothing when its conditions kept nothing, and never its rejected rows", () => {
  const answer = filteredListAnswer(rows({ rejected: REJECTED, rejectedMissing: new Set(["rating"]), rejectedTruncated: true }), false, "kept");
  assert.deepEqual(answer.records, []);
  assert.equal(answer.unfiltered, false);
  // The rejected rows are not the answer, so neither their missing fields nor
  // the bound that cut them short is the answer's.
  assert.deepEqual(answer.missingFields, []);
  assert.equal(answer.truncated, false);
  // What it kept, when it kept something, is unchanged.
  assert.deepEqual(filteredListAnswer(rows({ kept: KEPT, rejected: REJECTED }), true, "kept").records, KEPT);
  assert.equal(filteredListAnswer(rows({ kept: KEPT, rejected: REJECTED }), true, "kept").truncated, true);
});

test("an exploration read, which names no answer rule, keeps the floor", () => {
  const answer = filteredListAnswer(rows({ rejected: REJECTED }), false, undefined);
  assert.deepEqual(answer.records, REJECTED);
  assert.equal(answer.unfiltered, true);
});
