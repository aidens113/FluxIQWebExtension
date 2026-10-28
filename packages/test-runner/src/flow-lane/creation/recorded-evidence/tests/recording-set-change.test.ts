import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../../../failure.js";
import { assertRecordingSetChangedByExactly } from "../recording-set-change.js";

const mine = { recordingId: "rec.mine", description: "I show it." };
const listing = (...items: Array<Record<string, unknown>>) => ({ payload: { recordings: items } });
const finished = { recordingId: "rec.mine", endedAt: 1700000000000, description: "  I show it.  " };
const fact = (run: () => void) => {
  try { run(); } catch (error) { return error instanceof RunnerFailure ? error.details?.fact : `not a runner failure: ${String(error)}`; }
  return "held";
};

test("holds when exactly the demonstration's recording was added, finalized and described", () => {
  assert.equal(fact(() => assertRecordingSetChangedByExactly(new Set(["rec.old"]), listing({ recordingId: "rec.old" }, finished), mine)), "held");
});

test("fails recording.set when nothing, another recording, a second one, or a removal changed the set", () => {
  const before = new Set(["rec.old"]);
  assert.equal(fact(() => assertRecordingSetChangedByExactly(before, listing({ recordingId: "rec.old" }), mine)), "recording.set");
  assert.equal(fact(() => assertRecordingSetChangedByExactly(before, listing({ recordingId: "rec.old" }, { recordingId: "rec.other", endedAt: 1, description: "I show it." }), mine)), "recording.set");
  assert.equal(fact(() => assertRecordingSetChangedByExactly(before, listing({ recordingId: "rec.old" }, finished, { recordingId: "rec.extra", endedAt: 1 }), mine)), "recording.set");
  assert.equal(fact(() => assertRecordingSetChangedByExactly(before, listing(finished), mine)), "recording.set");
});

test("fails recording.finalized for an open recording and recording.described for another description", () => {
  assert.equal(fact(() => assertRecordingSetChangedByExactly(new Set(), listing({ recordingId: "rec.mine", description: "I show it." }), mine)), "recording.finalized");
  assert.equal(fact(() => assertRecordingSetChangedByExactly(new Set(), listing({ ...finished, description: "Something else." }), mine)), "recording.described");
});

test("reads a recording under either id field and any of Core's envelopes", () => {
  assert.equal(fact(() => assertRecordingSetChangedByExactly(new Set(), { payload: { items: [{ id: "rec.mine", endedAt: 5, description: "I show it." }] } }, mine)), "held");
});
