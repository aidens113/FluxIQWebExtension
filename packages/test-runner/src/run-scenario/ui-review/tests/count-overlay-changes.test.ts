import assert from "node:assert/strict";
import test from "node:test";
import { countOverlayChanges, type OverlaySample } from "../index.js";

const shown = (atMs: number, text: string, visible = true): OverlaySample => ({ atMs, present: true, hostCount: 1, visible, text, textParts: text.split(" | ") });
const gone = (atMs: number): OverlaySample => ({ atMs, present: false, hostCount: 0, visible: false });
const failed = (atMs: number): OverlaySample => ({ atMs, present: false, hostCount: 0, visible: false, error: "read timed out" });

test("an overlay that shows one status throughout is stable", () => {
  const counts = countOverlayChanges([0, 200, 400, 600].map(at => shown(at, "BUILDING | Reading the page")));
  assert.deepEqual(counts, { samples: 4, readFailures: 0, presentSamples: 4, visibleSamples: 4, textChanges: 0, presenceToggles: 0, visibilityToggles: 0, textRevisits: 0, distinctTexts: 1, pageLoads: 0, pageLoadGaps: 0, probablePageLoads: 0, status: "stable" });
});

test("no overlay in any sample is absent, not stable", () => {
  const counts = countOverlayChanges([gone(0), gone(200), gone(400)]);
  assert.equal(counts.status, "absent");
  assert.equal(counts.presentSamples, 0);
  assert.equal(counts.presenceToggles, 0);
});

test("one change of status is counted and reads as changed", () => {
  const counts = countOverlayChanges([shown(0, "A"), shown(200, "A"), shown(400, "B"), shown(600, "B")]);
  assert.equal(counts.textChanges, 1);
  assert.equal(counts.distinctTexts, 2);
  assert.equal(counts.status, "changed");
});

test("a status that switches back and forth is flickering, and each switch is a change", () => {
  const counts = countOverlayChanges([shown(0, "A"), shown(200, "B"), shown(400, "A"), shown(600, "B")]);
  assert.equal(counts.textChanges, 3);
  assert.equal(counts.textRevisits, 2, "A then B again are both returns to a text already shown");
  assert.equal(counts.status, "flickering");
});

test("an overlay that comes and goes counts presence toggles, and the text is compared only across present samples", () => {
  const counts = countOverlayChanges([shown(0, "A"), gone(200), shown(400, "A"), gone(600)]);
  assert.equal(counts.presenceToggles, 3);
  assert.equal(counts.textChanges, 0, "the same status reappearing is not a text change");
  assert.equal(counts.status, "flickering");
});

test("visibility flips are counted apart from presence", () => {
  const counts = countOverlayChanges([shown(0, "A"), shown(200, "A", false), shown(400, "A")]);
  assert.equal(counts.visibilityToggles, 2);
  assert.equal(counts.presenceToggles, 0);
  assert.equal(counts.visibleSamples, 2);
  assert.equal(counts.status, "flickering");
});

test("a failed read is counted and skipped: it is neither absence nor a toggle", () => {
  const counts = countOverlayChanges([shown(0, "A"), failed(200), shown(400, "A")]);
  assert.equal(counts.readFailures, 1);
  assert.equal(counts.presenceToggles, 0);
  assert.equal(counts.status, "stable");
});

// A sample read from a given document (`performance.timeOrigin`).
const inDoc = (sample: OverlaySample, documentOrigin: number): OverlaySample => ({ ...sample, documentOrigin });

test("one absent sample between two documents is a page load, not flicker", () => {
  const counts = countOverlayChanges([inDoc(shown(0, "A"), 1), inDoc(shown(200, "A"), 1), inDoc(gone(400), 2), inDoc(shown(600, "B"), 2), inDoc(shown(800, "B"), 2)]);
  assert.equal(counts.pageLoads, 1);
  assert.equal(counts.pageLoadGaps, 1);
  assert.equal(counts.presenceToggles, 0);
  assert.equal(counts.visibilityToggles, 0);
  assert.equal(counts.textChanges, 1);
  assert.equal(counts.status, "changed");
  const same = countOverlayChanges([inDoc(shown(0, "A"), 1), inDoc(gone(200), 1), inDoc(shown(400, "A"), 2)]);
  assert.equal(same.pageLoads, 1, "the gap read the old document, the next sample the new one: one load");
  assert.equal(same.pageLoadGaps, 1);
  assert.equal(same.status, "stable", "the same status across a page load is unchanged");
});

test("one absent sample inside one document still counts two toggles and is flickering", () => {
  const counts = countOverlayChanges([inDoc(shown(0, "A"), 1), inDoc(gone(200), 1), inDoc(shown(400, "A"), 1)]);
  assert.equal(counts.pageLoads, 0);
  assert.equal(counts.pageLoadGaps, 0);
  assert.equal(counts.presenceToggles, 2);
  assert.equal(counts.status, "flickering");
});

test("two absent samples across a document change still count as toggles", () => {
  const counts = countOverlayChanges([inDoc(shown(0, "A"), 1), inDoc(gone(200), 1), inDoc(gone(400), 2), inDoc(shown(600, "A"), 2)]);
  assert.equal(counts.pageLoads, 1, "the document still changed");
  assert.equal(counts.pageLoadGaps, 0, "but a two-sample absence is not excused");
  assert.equal(counts.presenceToggles, 2);
  assert.equal(counts.status, "flickering");
});

test("an absence next to a failed read, or between samples that cannot name their document, counts as before", () => {
  const nextToFailure = countOverlayChanges([inDoc(shown(0, "A"), 1), failed(200), inDoc(gone(400), 2), inDoc(shown(600, "A"), 2)]);
  assert.equal(nextToFailure.pageLoads, 1, "the document changed across the failed read");
  assert.equal(nextToFailure.pageLoadGaps, 0);
  assert.equal(nextToFailure.presenceToggles, 2);
  const unnamed = countOverlayChanges([shown(0, "A"), gone(200), inDoc(shown(400, "A"), 2)]);
  assert.equal(unnamed.pageLoads, 0, "only one sample names its document");
  assert.equal(unnamed.pageLoadGaps, 0);
  assert.equal(unnamed.presenceToggles, 2);
});

test("a revisit across a page load is still flickering", () => {
  const counts = countOverlayChanges([inDoc(shown(0, "A"), 1), inDoc(shown(200, "B"), 1), inDoc(gone(400), 1), inDoc(shown(600, "A"), 2)]);
  assert.equal(counts.pageLoads, 1);
  assert.equal(counts.textRevisits, 1);
  assert.equal(counts.status, "flickering");
});

// Run murzln6g moment 6: twelve samples in one document, four in the next, the overlay present and unchanged in all sixteen.
test("a document swap with the overlay present in every sample is a page load, and makes no toggle", () => {
  const status = "Building your Flow | Typing into the search box";
  const samples = Array.from({ length: 16 }, (_, index) => inDoc(shown(index * 200, status), index < 12 ? 1791007662125.9 : 1791007670175.4));
  const counts = countOverlayChanges(samples);
  assert.equal(counts.pageLoads, 1);
  assert.equal(counts.pageLoadGaps, 0);
  assert.equal(counts.presenceToggles, 0);
  assert.equal(counts.status, "stable");
});

test("each document change is a page load, a failed read and a sample that names no document skipped", () => {
  const counts = countOverlayChanges([inDoc(shown(0, "A"), 1), inDoc(shown(200, "A"), 2), failed(400), shown(600, "A"), inDoc(shown(800, "A"), 3), inDoc(shown(1000, "A"), 3)]);
  assert.equal(counts.pageLoads, 2);
  assert.equal(counts.pageLoadGaps, 0);
  assert.equal(counts.readFailures, 1);
});

const of = (sample: OverlaySample, documentOrigin: number): OverlaySample => ({ ...sample, documentOrigin });
const hostGone = (atMs: number, documentOrigin?: number): OverlaySample => ({ atMs, present: false, hostCount: 0, visible: false, error: "the overlay host went away between two reads", navigationSuspected: true, ...(documentOrigin === undefined ? {} : { documentOrigin }) });

test("a window that ends in a failed read naming a new document counts that page load (D13)", () => {
  const counts = countOverlayChanges([of(shown(0, "Building"), 1), of(shown(2604, "Building | Opening where the Flow starts"), 1), hostGone(3003, 2)]);
  assert.equal(counts.readFailures, 1);
  assert.equal(counts.pageLoads, 1, "the origin re-read after the failure is a new document");
  assert.equal(counts.probablePageLoads, 0);
  assert.equal(counts.presenceToggles, 0, "a failed read is still no toggle");
});

test("a window that ends in a navigation-shaped failure with no readable document counts a probable page load, said apart (D13)", () => {
  const unread = countOverlayChanges([of(shown(0, "A"), 1), of(shown(200, "A"), 1), hostGone(400)]);
  assert.equal(unread.pageLoads, 0, "nothing proves the load");
  assert.equal(unread.probablePageLoads, 1);
  const sameDocument = countOverlayChanges([of(shown(0, "A"), 1), hostGone(200, 1)]);
  assert.equal(sameDocument.probablePageLoads, 1, "a re-read that still sees the old document may have read it before the swap");
  const settled = countOverlayChanges([of(shown(0, "A"), 1), hostGone(200), of(gone(400), 1)]);
  assert.equal(settled.probablePageLoads, 0, "a later read of the same document says the host went away without a load");
  assert.equal(settled.pageLoads, 0);
  const loaded = countOverlayChanges([of(shown(0, "A"), 1), hostGone(200), of(shown(400, "A"), 2)]);
  assert.deepEqual([loaded.pageLoads, loaded.probablePageLoads], [1, 0], "a later read of a new document is the load itself, counted once");
  const plainFailure = countOverlayChanges([of(shown(0, "A"), 1), failed(200)]);
  assert.equal(plainFailure.probablePageLoads, 0, "a timeout says nothing about a navigation");
});
