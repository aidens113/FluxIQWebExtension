import assert from "node:assert/strict";
import test from "node:test";
import { recordingIds } from "../recording-ids.js";

test("every shape Core has answered list_recordings in is read", () => {
  const expected = new Set(["recording.one", "recording.two"]);
  assert.deepEqual(recordingIds({ payload: { recordings: [{ recordingId: "recording.one" }, { recordingId: "recording.two" }] } }), expected);
  assert.deepEqual(recordingIds({ payload: { items: [{ recordingId: "recording.one" }, { id: "recording.two" }] } }), expected);
  assert.deepEqual(recordingIds({ payload: [{ id: "recording.one" }, { id: "recording.two" }] }), expected);
});

test("an item with no usable id is skipped rather than admitted as an empty one", () => {
  assert.deepEqual(recordingIds({ payload: { recordings: [{ recordingId: "" }, { id: 7 }, {}, null, { recordingId: "recording.kept" }] } }), new Set(["recording.kept"]));
});

/**
 * The empty answer is the dangerous one, and the reason it is safe here is that
 * the caller never treats it as an answer: `assertCoreRoundTrip` compares the set
 * against a baseline and fails as `recording.persistence` when nothing new
 * appears, so an unreadable response becomes a named failure rather than
 * "this project has no recordings".
 */
test("a response in no known shape yields an empty set, which the caller fails on rather than accepts", () => {
  for (const response of [undefined, null, {}, { payload: undefined }, { payload: { recordings: "not-an-array" } }, { recordings: [{ id: "outside-payload" }] }]) {
    assert.deepEqual(recordingIds(response), new Set(), JSON.stringify(response ?? null));
  }
});
