// The snapshot list's structure across the frame merge (t223): each frame's
// `parent` indexes its own list, and the merge appends each frame's list as a
// block, so every block after the first has its `parent` values moved by
// where it starts. `ownText` and `hidden` cross as the frame wrote them. A look
// asked `includeHidden` asks every frame it captures for its hidden elements,
// and every other merge asks exactly as it always did.

import assert from "node:assert/strict";
import { test } from "node:test";
import { captureMergedTabSnapshot, type DomSnapshotPayload, type TabSnapshotTransport } from "../dom-snapshot";
import type { DomElementDescriptor } from "../../../shared/protocol";

const SEED_FRAME_ID = 0;

type Sent = { frameId: number | undefined; message: unknown };

/** Every frame answers; `sent` records what each was asked. */
function transportFor(frames: ReadonlyMap<number, DomSnapshotPayload>, sent: Sent[]): TabSnapshotTransport {
  return {
    sendToTab: async <TResponse = unknown>(_tabId: number, message: unknown, frameId?: number): Promise<TResponse> => {
      sent.push({ frameId, message });
      return frames.get(frameId ?? 0) as TResponse;
    },
    allTabFrames: async () => [...frames.keys()].map((frameId) => ({ frameId }) as chrome.webNavigation.GetAllFrameResultDetails)
  };
}

/** The domain's snapshot input does not declare the snapshot-scoped fields, so the frames are written as the extension's descriptors. */
function snapshot(isTop: boolean, interactiveElements: DomElementDescriptor[]): DomSnapshotPayload {
  return {
    url: isTop ? "https://shop.example/" : "https://help.example/chat",
    title: isTop ? "Shop" : "Chat",
    viewport: { width: 1280, height: 800, scrollX: 0, scrollY: 0 },
    frame: isTop ? { isTop: true } : { isTop: false, viewportOffset: { x: 900, y: 500, width: 300, height: 200 } },
    interactiveElements
  };
}

function topFrame(): DomSnapshotPayload {
  return snapshot(true, [
    { tagName: "ul", selector: "#menu" },
    { tagName: "li", selector: "#menu > li", text: "Deals Today", ownText: "Deals", parent: 0 },
    { tagName: "a", selector: "#menu a", text: "Today", parent: 1 }
  ]);
}

function chatFrame(): DomSnapshotPayload {
  return snapshot(false, [
    { tagName: "section", selector: "#chat" },
    { tagName: "button", selector: "#chat button", text: "Close", parent: 0 },
    { tagName: "p", selector: "#chat p", text: "Agent typing", ownText: "", parent: 0, hidden: true }
  ]);
}

function framesOf(...entries: Array<[number, DomSnapshotPayload]>): Map<number, DomSnapshotPayload> {
  return new Map(entries);
}

test("a child frame's parents are moved to index the merged list, and the top frame's are left as written", async () => {
  const sent: Sent[] = [];
  const merged = await captureMergedTabSnapshot(transportFor(framesOf([0, topFrame()], [3, chatFrame()]), sent), 7, topFrame(), SEED_FRAME_ID);
  const elements = (merged?.interactiveElements ?? []) as DomElementDescriptor[];
  assert.deepEqual(elements.map((element) => element.parent), [undefined, 0, 1, undefined, 3, 3]);
  // Every parent names an element of its own frame on the merged list.
  assert.equal(elements[4]?.selector, "frame[3] >> #chat button");
  assert.equal(elements[elements[4]!.parent!]?.selector, "frame[3] >> #chat");
});

test("ownText and hidden cross the merge as the frame wrote them", async () => {
  const sent: Sent[] = [];
  const merged = await captureMergedTabSnapshot(transportFor(framesOf([0, topFrame()], [3, chatFrame()]), sent), 7, topFrame(), SEED_FRAME_ID);
  const elements = (merged?.interactiveElements ?? []) as DomElementDescriptor[];
  assert.equal(elements[1]?.ownText, "Deals");
  assert.equal(elements[5]?.ownText, "");
  assert.equal(elements[5]?.hidden, true);
  assert.equal(elements[4]?.hidden, undefined);
});

test("a seed from a child frame leads the list, and the top frame's block is the one moved", async () => {
  const sent: Sent[] = [];
  const merged = await captureMergedTabSnapshot(transportFor(framesOf([0, topFrame()], [3, chatFrame()]), sent), 7, chatFrame(), 3);
  const elements = (merged?.interactiveElements ?? []) as DomElementDescriptor[];
  assert.deepEqual(elements.map((element) => element.parent), [undefined, 0, 0, undefined, 3, 4]);
});

test("a merge asked includeHidden asks every frame it captures for its hidden elements; any other merge asks as it always did", async () => {
  const asked: Sent[] = [];
  await captureMergedTabSnapshot(transportFor(framesOf([0, topFrame()], [3, chatFrame()]), asked), 7, topFrame(), SEED_FRAME_ID, { includeHidden: true });
  assert.deepEqual(asked, [{ frameId: 3, message: { type: "captureSnapshot", includeHidden: true } }], "the seed is not asked again");

  const unseeded: Sent[] = [];
  await captureMergedTabSnapshot(transportFor(framesOf([0, topFrame()], [3, chatFrame()]), unseeded), 7, undefined, undefined, { includeHidden: true });
  assert.deepEqual(unseeded.map((entry) => entry.message), [
    { type: "captureSnapshot", includeHidden: true },
    { type: "captureSnapshot", includeHidden: true }
  ]);

  const plain: Sent[] = [];
  await captureMergedTabSnapshot(transportFor(framesOf([0, topFrame()], [3, chatFrame()]), plain), 7, topFrame(), SEED_FRAME_ID);
  assert.deepEqual(plain, [{ frameId: 3, message: { type: "captureSnapshot" } }]);
});

test("a single-frame merge hands the frame's elements over untouched", async () => {
  const top = topFrame();
  const merged = await captureMergedTabSnapshot(transportFor(framesOf([0, top]), []), 7, top, SEED_FRAME_ID);
  assert.equal(merged?.interactiveElements[1], top.interactiveElements[1], "the same object, not a copy");
});
