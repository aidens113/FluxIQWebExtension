import assert from "node:assert/strict";
import test from "node:test";
import { webRecordedRecordValueMatches } from "..";

test("record value comparison preserves exact and historical prefix behavior", () => {
  assert.equal(webRecordedRecordValueMatches("A", "A", "key"), true);
  assert.equal(webRecordedRecordValueMatches("a", "A", "key"), false);
  assert.equal(webRecordedRecordValueMatches(undefined, "A", "key"), false);
  assert.equal(webRecordedRecordValueMatches("x".repeat(121), "x".repeat(120), "key"), true);
  assert.equal(webRecordedRecordValueMatches("x".repeat(120), "x".repeat(119), "key"), false);
  assert.equal(webRecordedRecordValueMatches("x".repeat(161), "x".repeat(160), "text"), true);
  assert.equal(webRecordedRecordValueMatches("x".repeat(161), "x".repeat(159), "text"), false);
});
