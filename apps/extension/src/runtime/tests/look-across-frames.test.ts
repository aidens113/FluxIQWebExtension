// The look takes in every frame (t200): `web.dom.capture_snapshot` addressed to
// no frame answers with the background worker's merge of every frame, seeded
// with the top frame's own capture, and one addressed to a frame keeps that
// frame's. The merge itself is `background/connection/dom-snapshot.ts`'s and is
// covered there; this pins when the runner asks for it and what it does with
// the answer.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { BrowserActionCommand, BrowserActionResult, DomSnapshot } from "../../shared/protocol";
import type { BrowserActionRunResult } from "../action-runner";
import { lookAcrossFrames, type MergeFrameSnapshots } from "../look-across-frames";

const TAB_ID = 12;

function snapshot(selectors: string[]): DomSnapshot {
  return {
    url: "https://shop.example/",
    title: "Shop",
    viewport: { width: 1280, height: 800, scrollX: 0, scrollY: 0 },
    interactiveElements: selectors.map((selector) => ({ tagName: "button", selector }))
  };
}

const TOP = snapshot(["#accept"]);
const MERGED = snapshot(["#accept", "frame[3] >> #checkbox"]);

function run(status: BrowserActionResult["status"] = "succeeded", result: Partial<BrowserActionResult> = { snapshot: TOP }): BrowserActionRunResult {
  return {
    result: { commandId: "c-look", actionType: "web.dom.capture_snapshot", status, validation: { status: "none", reason: "evidence-only" }, startedAt: 1, finishedAt: 2, ...result },
    tabId: TAB_ID,
    frameId: 0
  };
}

/** A merge that records what it was asked and answers `answer`. */
function mergeAnswering(answer: DomSnapshot | undefined): { merge: MergeFrameSnapshots; asked: Array<{ tabId: number; top: DomSnapshot; waitMs: number | undefined }> } {
  const asked: Array<{ tabId: number; top: DomSnapshot; waitMs: number | undefined }> = [];
  return { asked, merge: async (tabId, top, waitMs) => { asked.push({ tabId, top, waitMs }); return answer; } };
}

const LOOK: BrowserActionCommand = { commandId: "c-look", actionType: "web.dom.capture_snapshot" };

test("a look that names no frame answers with every frame, merged around the top frame's own capture", async () => {
  const { merge, asked } = mergeAnswering(MERGED);
  const looked = await lookAcrossFrames(LOOK, run(), false, Date.now(), merge);
  assert.equal(looked.result.snapshot, MERGED);
  assert.deepEqual(asked, [{ tabId: TAB_ID, top: TOP, waitMs: undefined }], "the top frame's capture is the merge's seed, and no deadline was invented");
  assert.equal(looked.frameId, 0, "the look still reports the frame it ran in");
});

test("a look addressed to a frame keeps that frame's snapshot", async () => {
  const { merge, asked } = mergeAnswering(MERGED);
  const looked = await lookAcrossFrames(LOOK, run(), true, Date.now(), merge);
  assert.equal(looked.result.snapshot, TOP);
  assert.deepEqual(asked, []);
});

test("only a look is merged, and only one that succeeded with a snapshot", async () => {
  const { merge, asked } = mergeAnswering(MERGED);
  const click: BrowserActionCommand = { commandId: "c-click", actionType: "web.dom.click", selector: "#accept" };
  assert.equal((await lookAcrossFrames(click, run(), false, Date.now(), merge)).result.snapshot, TOP);
  assert.equal((await lookAcrossFrames(LOOK, run("failed"), false, Date.now(), merge)).result.snapshot, TOP);
  assert.equal((await lookAcrossFrames(LOOK, run("succeeded", {}), false, Date.now(), merge)).result.snapshot, undefined);
  assert.deepEqual(asked, []);
});

test("a merge that could not be made leaves the top frame's look standing", async () => {
  const { merge } = mergeAnswering(undefined);
  assert.equal((await lookAcrossFrames(LOOK, run(), false, Date.now(), merge)).result.snapshot, TOP);
  assert.equal((await lookAcrossFrames(LOOK, run(), false, Date.now(), undefined)).result.snapshot, TOP);
});

test("a look with a deadline of its own lends the merge what is left of it", async (t) => {
  t.mock.method(Date, "now", () => 10_000);
  const { merge, asked } = mergeAnswering(MERGED);
  await lookAcrossFrames({ ...LOOK, timeoutMs: 5_000 }, run(), false, 8_500, merge);
  await lookAcrossFrames({ ...LOOK, timeoutMs: 1_000 }, run(), false, 8_500, merge);
  assert.deepEqual(asked.map((call) => call.waitMs), [3_500, 0]);
});

test("a search's look (includeHidden) asks the merge to ask every frame for its hidden elements; a plain look asks for nothing", async () => {
  const captures: unknown[] = [];
  const merge: MergeFrameSnapshots = async (_tabId, _top, _waitMs, capture) => {
    captures.push(capture);
    return MERGED;
  };
  await lookAcrossFrames({ ...LOOK, options: { includeHidden: true } }, run(), false, Date.now(), merge);
  await lookAcrossFrames(LOOK, run(), false, Date.now(), merge);
  await lookAcrossFrames({ ...LOOK, options: { includeHidden: "yes" } }, run(), false, Date.now(), merge);
  assert.deepEqual(captures, [{ includeHidden: true }, {}, {}]);
});
