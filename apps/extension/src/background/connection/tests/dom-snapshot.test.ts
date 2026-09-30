// What a merged tab snapshot says about a page made of more than one frame.
//
// The elements of every frame have been merged into one list since Phase 1.2,
// but everything else was taken from the top frame by a spread, so the page
// evidence Phase 1.4 added described the top frame alone however many frames
// contributed elements. These tests pin the item-by-item rule that replaced it:
// what is additive, what is one document's and stays the top frame's, and that
// a single-frame page is left exactly as it was.

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  captureMergedTabSnapshot,
  type DomSnapshotPayload,
  type TabSnapshotTransport
} from "../dom-snapshot";
import type { PageEvidence, RectDescriptor } from "../../../shared/protocol";

type FrameFixture = { frameId: number; snapshot: DomSnapshotPayload };

const CHILD_FRAME_ID = 2;
// The iframe's box in the top frame's viewport, and the top frame's own scroll,
// so a translated rect is visibly neither of the two source coordinates.
const CHILD_VIEWPORT_OFFSET: RectDescriptor = { x: 100, y: 50, width: 400, height: 300 };
const TOP_SCROLL_Y = 20;

/** Every frame answers when asked; `listed` is what the frame list names, which is every frame unless a test says otherwise. */
function transportFor(frames: readonly FrameFixture[], listed: readonly number[] = frames.map((frame) => frame.frameId)): TabSnapshotTransport {
  return {
    sendToTab: async <TResponse = unknown>(_tabId: number, _message: unknown, frameId?: number): Promise<TResponse> =>
      frames.find((frame) => frame.frameId === (frameId ?? 0))?.snapshot as TResponse,
    allTabFrames: async () => listed.map((frameId) => ({ frameId }) as chrome.webNavigation.GetAllFrameResultDetails)
  };
}

function elementsTotals(returned: number, overrides: Partial<PageEvidence["elements"]> = {}): PageEvidence["elements"] {
  return {
    scanned: returned * 10,
    candidates: returned * 4,
    matched: returned,
    returned,
    truncated: false,
    changed: 0,
    recentlyInteracted: 0,
    ...overrides
  };
}

function topSnapshot(): DomSnapshotPayload {
  return {
    url: "https://shop.example/checkout",
    title: "Checkout",
    viewport: { width: 1280, height: 800, scrollX: 0, scrollY: TOP_SCROLL_Y },
    frame: { isTop: true },
    interactiveElements: [{ tagName: "BUTTON", selector: "#pay", documentBounds: { x: 4, y: 4, width: 60, height: 20 } }],
    evidence: {
      elements: elementsTotals(1, { changed: 1 }),
      loading: { documentState: "complete", busy: false, busyRegions: [], indicators: [], pendingNavigation: false },
      navigation: {
        url: "https://shop.example/checkout",
        origin: "https://shop.example",
        path: "/checkout",
        historyLength: 3,
        visibility: "visible"
      },
      regions: [{ role: "main", selector: "#page", label: "Checkout" }]
    }
  };
}

function childSnapshot(): DomSnapshotPayload {
  return {
    url: "https://pay.example/card",
    title: "Card details",
    viewport: { width: 400, height: 300, scrollX: 0, scrollY: 0 },
    frame: { isTop: false, viewportOffset: CHILD_VIEWPORT_OFFSET },
    interactiveElements: [
      { tagName: "INPUT", selector: "#card", documentBounds: { x: 8, y: 8, width: 200, height: 24 } },
      { tagName: "BUTTON", selector: "#confirm", documentBounds: { x: 8, y: 40, width: 90, height: 24 } }
    ],
    evidence: {
      elements: elementsTotals(2, { recentlyInteracted: 1 }),
      loading: {
        documentState: "loading",
        busy: true,
        busyRegions: ["#card-status"],
        indicators: [{ selector: "#card-spinner", kind: "spinner" }],
        pendingNavigation: true
      },
      navigation: {
        url: "https://pay.example/card",
        origin: "https://pay.example",
        path: "/card",
        historyLength: 1,
        visibility: "visible"
      },
      dialogs: {
        open: [{ selector: "#three-ds", role: "dialog", modal: true, native: false, bounds: { x: 10, y: 10, width: 200, height: 100 } }],
        modal: true
      },
      overlays: { tested: 2, blockedCount: 1, blockers: [{ selector: "#veil", blocks: 1, blocked: ["#confirm"] }] },
      regions: [{ role: "form", selector: "#card-form", label: "Card details" }],
      // The child carries every item the top frame does not, so the two
      // fixtures together exercise all eight keys of the contract. The merge is
      // the only place a whole item can go missing, and it does so silently.
      repeating: [{
        containerSelector: "#saved-cards",
        signature: "li[data-testid^='card-']",
        itemCount: 3,
        representative: { selector: "#saved-cards > li:nth-child(1)", testId: "card-1", text: "Visa 4242" }
      }],
      forms: [{
        selector: "#card-form",
        controlCount: 1,
        controls: [{ selector: "#card", controlType: "text", sensitive: true }],
        submit: "#confirm"
      }]
    }
  };
}

async function mergeOf(frames: readonly FrameFixture[]): Promise<DomSnapshotPayload> {
  const merged = await captureMergedTabSnapshot(transportFor(frames), 7);
  assert.ok(merged, "the merge produced no snapshot");
  return merged;
}

async function mergedEvidence(frames: readonly FrameFixture[]): Promise<PageEvidence> {
  const evidence = (await mergeOf(frames)).evidence;
  assert.ok(evidence, "the merged snapshot carried no evidence");
  return evidence;
}

const bothFrames: readonly FrameFixture[] = [
  { frameId: 0, snapshot: topSnapshot() },
  { frameId: CHILD_FRAME_ID, snapshot: childSnapshot() }
];

test("a merged snapshot carries the dialogs, overlays, regions and forms of a child frame, not only the top frame's", async () => {
  const evidence = await mergedEvidence(bothFrames);
  assert.equal(evidence.dialogs?.open.length, 1);
  assert.equal(evidence.dialogs?.modal, true);
  assert.equal(evidence.overlays?.blockedCount, 1);
  assert.deepEqual(evidence.regions?.map((region) => region.role), ["main", "form"]);
  assert.equal(evidence.forms?.length, 1);
});

test("a child frame's selectors are qualified by the frame, exactly as its elements' are", async () => {
  const merged = await mergeOf(bothFrames);
  const evidence = merged.evidence;
  const prefix = `frame[${CHILD_FRAME_ID}] >> `;
  assert.equal(evidence?.dialogs?.open[0]?.selector, `${prefix}#three-ds`);
  assert.equal(evidence?.overlays?.blockers[0]?.selector, `${prefix}#veil`);
  assert.deepEqual(evidence?.overlays?.blockers[0]?.blocked, [`${prefix}#confirm`]);
  assert.equal(evidence?.regions?.[1]?.selector, `${prefix}#card-form`);
  assert.equal(evidence?.forms?.[0]?.selector, `${prefix}#card-form`);
  assert.equal(evidence?.forms?.[0]?.controls[0]?.selector, `${prefix}#card`);
  assert.equal(evidence?.forms?.[0]?.submit, `${prefix}#confirm`);
  assert.equal(evidence?.repeating?.[0]?.containerSelector, `${prefix}#saved-cards`);
  assert.equal(evidence?.repeating?.[0]?.representative.selector, `${prefix}#saved-cards > li:nth-child(1)`);
  assert.deepEqual(evidence?.loading.busyRegions, [`${prefix}#card-status`]);
  assert.equal(evidence?.loading.indicators[0]?.selector, `${prefix}#card-spinner`);
  // The top frame's own selectors are untouched, and the elements use the same
  // prefix, so a reader can join the two.
  assert.equal(evidence?.regions?.[0]?.selector, "#page");
  assert.equal(merged.interactiveElements[1]?.selector, `${prefix}#card`);
});

test("a child frame's evidence rects are placed on the top frame's page", async () => {
  const evidence = await mergedEvidence(bothFrames);
  // 10 inside the frame, + the frame's offset in the top viewport, + the top
  // frame's scroll: the same arithmetic `translateFrameElements` applies.
  assert.deepEqual(evidence.dialogs?.open[0]?.bounds, {
    x: CHILD_VIEWPORT_OFFSET.x + 10,
    y: CHILD_VIEWPORT_OFFSET.y + 10 + TOP_SCROLL_Y,
    width: 200,
    height: 100
  });
});

test("the element totals count the frames the element list spans", async () => {
  const merged = await mergeOf(bothFrames);
  assert.equal(merged.interactiveElements.length, 3);
  assert.equal(merged.evidence?.elements.returned, 3);
  assert.equal(merged.evidence?.elements.matched, 3);
  assert.equal(merged.evidence?.elements.scanned, 30);
  assert.equal(merged.evidence?.elements.changed, 1);
  assert.equal(merged.evidence?.elements.recentlyInteracted, 1);
  assert.equal(merged.evidence?.elements.truncated, false);
});

test("truncation anywhere truncates the merged snapshot", async () => {
  const child = childSnapshot();
  child.evidence = { ...child.evidence!, elements: elementsTotals(2, { matched: 900, truncated: true }) };
  const evidence = await mergedEvidence([{ frameId: 0, snapshot: topSnapshot() }, { frameId: CHILD_FRAME_ID, snapshot: child }]);
  assert.equal(evidence.elements.truncated, true);
});

test("the page is loading while any frame is, but readyState stays the top document's", async () => {
  const evidence = await mergedEvidence(bothFrames);
  assert.equal(evidence.loading.documentState, "complete");
  assert.equal(evidence.loading.busy, true);
  assert.equal(evidence.loading.pendingNavigation, true);
});

test("navigation is the top frame's: a child frame's origin is not the page's", async () => {
  const evidence = await mergedEvidence(bothFrames);
  assert.deepEqual(evidence.navigation, topSnapshot().evidence?.navigation);
});

test("a single-frame page is merged into exactly the evidence it reported", async () => {
  const only = topSnapshot();
  const evidence = await mergedEvidence([{ frameId: 0, snapshot: only }]);
  assert.deepEqual(evidence, only.evidence);
});

test("a top frame that reports no evidence falls back to the only frame that did", async () => {
  const top = topSnapshot();
  delete top.evidence;
  const evidence = await mergedEvidence([{ frameId: 0, snapshot: top }, { frameId: CHILD_FRAME_ID, snapshot: childSnapshot() }]);
  assert.equal(evidence.navigation.origin, "https://pay.example");
  assert.equal(evidence.loading.documentState, "loading");
  assert.equal(evidence.elements.returned, 2);
});

test("a snapshot with no evidence anywhere gains none", async () => {
  const top = topSnapshot();
  delete top.evidence;
  const merged = await mergeOf([{ frameId: 0, snapshot: top }]);
  assert.equal(merged.evidence, undefined);
  assert.equal(merged.interactiveElements.length, 1);
});

// The merge used to name the contract's keys by hand, so an item it forgot was
// produced by every frame and then dropped from the page -- invisible on a
// single-frame fixture and green everywhere. It is now written through
// `present<PageEvidence>`, which will not compile until every key is named; the
// compiler owns "no key is forgotten". These two rows own what a compiler
// cannot see: that a key the frames did send arrives, and that a key they did
// not send stays absent rather than arriving empty.

test("the merged page carries every item some frame reported, and no other", async () => {
  const reported = [...new Set(bothFrames.flatMap((frame) => Object.keys(frame.snapshot.evidence ?? {})))].sort();
  const evidence = await mergedEvidence(bothFrames);
  assert.equal(reported.length, 8, "the fixtures no longer exercise every key of the contract");
  assert.deepEqual(Object.keys(evidence).sort(), reported, "the merge dropped or invented a page-evidence item");
});

test("an item no frame reported is absent from the merged page, not present and empty", async () => {
  const child = childSnapshot();
  delete child.evidence?.dialogs;
  delete child.evidence?.overlays;
  const evidence = await mergedEvidence([{ frameId: 0, snapshot: topSnapshot() }, { frameId: CHILD_FRAME_ID, snapshot: child }]);
  assert.equal("dialogs" in evidence, false);
  assert.equal("overlays" in evidence, false);
  // And within an item: the child's dialog carries no `label`, and a dialog
  // with no label must not gain one as an undefined-valued key.
  const withDialog = await mergedEvidence(bothFrames);
  assert.equal("label" in (withDialog.dialogs?.open[0] ?? {}), false);
  assert.equal("armPending" in (withDialog.dialogs ?? {}), false);
});

// Nothing is cut (t200).
//
// The merged element list had a cap of 4,000 and every evidence collection its
// own, and the blockers were sorted by how much they covered and cut to ten.
// The user's order was that no limit stands between the page and the model, so
// these rows pin the opposite of what they used to: everything every frame
// sent arrives, in a fixed order, and nothing is marked truncated for it.

function crowdedFrame(frameId: number, count: number): FrameFixture {
  const isTop = frameId === 0;
  return {
    frameId,
    snapshot: {
      url: isTop ? "https://shop.example/checkout" : `https://widget-${frameId}.example/embed`,
      title: isTop ? "Checkout" : `Widget ${frameId}`,
      viewport: { width: 1280, height: 800, scrollX: 0, scrollY: 0 },
      frame: isTop ? { isTop: true } : { isTop: false, viewportOffset: CHILD_VIEWPORT_OFFSET },
      interactiveElements: Array.from({ length: count }, (_unused, index) => ({
        tagName: "BUTTON",
        selector: `#f${frameId}-e${index}`,
        documentBounds: { x: 0, y: index, width: 10, height: 10 }
      })),
      evidence: {
        elements: elementsTotals(count),
        loading: { documentState: "complete", busy: false, busyRegions: [], indicators: [], pendingNavigation: false },
        navigation: {
          url: isTop ? "https://shop.example/checkout" : `https://widget-${frameId}.example/embed`,
          origin: isTop ? "https://shop.example" : `https://widget-${frameId}.example`,
          path: isTop ? "/checkout" : "/embed",
          historyLength: 1,
          visibility: "visible"
        }
      }
    }
  };
}

/** The selectors a frame fixture of `count` elements carries, as the merge must pass them on. */
function selectorsOf(frameId: number, count: number): string[] {
  const prefix = frameId === 0 ? "" : `frame[${frameId}] >> `;
  return Array.from({ length: count }, (_unused, index) => `${prefix}#f${frameId}-e${index}`);
}

test("every element of every frame survives the merge, in frame order and in each frame's own order", async () => {
  // 1,000 from the page and 1,500 from each of three frames: 5,500 offered,
  // past the 4,000 the merge used to keep.
  const frames = [crowdedFrame(0, 1_000), crowdedFrame(1, 1_500), crowdedFrame(2, 1_500), crowdedFrame(3, 1_500)];
  const merged = await mergeOf(frames);

  assert.equal(merged.interactiveElements.length, 5_500, "the merged element list was cut");
  assert.deepEqual(
    merged.interactiveElements.map((element) => element.selector),
    [...selectorsOf(0, 1_000), ...selectorsOf(1, 1_500), ...selectorsOf(2, 1_500), ...selectorsOf(3, 1_500)]
  );
});

test("a merge of every element says it returned all of them and truncated none", async () => {
  const frames = [crowdedFrame(0, 1_000), crowdedFrame(1, 1_500), crowdedFrame(2, 1_500), crowdedFrame(3, 1_500)];
  const evidence = await mergedEvidence(frames);

  assert.equal(evidence.elements.returned, 5_500);
  assert.equal(evidence.elements.matched, 5_500);
  assert.equal(evidence.elements.truncated, false);
});

test("the frames follow the order the browser lists them, not the order they answer in", async () => {
  const frames = [crowdedFrame(0, 1), crowdedFrame(4, 1), crowdedFrame(9, 1)];
  const lateFirst: TabSnapshotTransport = {
    // Frame 4 answers last; the list still puts it before frame 9.
    sendToTab: async <TResponse = unknown>(_tabId: number, _message: unknown, frameId?: number): Promise<TResponse> => {
      if (frameId === 4) await new Promise((resolve) => setTimeout(resolve, 20));
      return frames.find((frame) => frame.frameId === (frameId ?? 0))?.snapshot as TResponse;
    },
    allTabFrames: async () => [0, 4, 9].map((frameId) => ({ frameId }) as chrome.webNavigation.GetAllFrameResultDetails)
  };
  const merged = await captureMergedTabSnapshot(lateFirst, 7);
  assert.deepEqual(merged?.interactiveElements.map((element) => element.selector), ["#f0-e0", "frame[4] >> #f4-e0", "frame[9] >> #f9-e0"]);
});

test("every evidence item of every frame is carried whole, blockers in frame order rather than by how much they cover", async () => {
  const top = topSnapshot();
  const child = childSnapshot();
  const many = <T>(count: number, make: (index: number) => T): T[] => Array.from({ length: count }, (_unused, index) => make(index));
  top.evidence = {
    ...top.evidence!,
    loading: { documentState: "complete", busy: true, busyRegions: many(30, (index) => `#busy-${index}`), indicators: many(30, (index) => ({ selector: `#spin-${index}`, kind: "spinner" as const })), pendingNavigation: false },
    dialogs: { open: many(12, (index) => ({ selector: `#dialog-${index}`, role: "dialog", modal: false, native: false })), modal: false },
    overlays: { tested: 40, blockedCount: 3, blockers: [{ selector: "#small", blocks: 1, blocked: ["#a"] }] },
    regions: many(50, (index) => ({ role: "region", selector: `#region-${index}` })),
    repeating: many(15, (index) => ({ containerSelector: `#list-${index}`, signature: "li", itemCount: 3, representative: { selector: `#list-${index} > li` } })),
    forms: many(20, (index) => ({ selector: `#form-${index}`, controlCount: 0, controls: [] }))
  };
  child.evidence = { ...child.evidence!, overlays: { tested: 9, blockedCount: 9, blockers: [{ selector: "#wall", blocks: 9, blocked: many(9, (index) => `#c${index}`) }] } };
  const evidence = await mergedEvidence([{ frameId: 0, snapshot: top }, { frameId: CHILD_FRAME_ID, snapshot: child }]);

  assert.equal(evidence.loading.busyRegions.length, 31, "busy regions were cut");
  assert.equal(evidence.loading.indicators.length, 31, "loading indicators were cut");
  assert.equal(evidence.dialogs?.open.length, 13, "dialogs were cut");
  assert.equal(evidence.regions?.length, 51, "regions were cut");
  assert.equal(evidence.repeating?.length, 16, "repeating structures were cut");
  assert.equal(evidence.forms?.length, 21, "forms were cut");
  // The child's wall covers more, and still follows the page's own blocker.
  assert.deepEqual(evidence.overlays?.blockers.map((blocker) => blocker.selector), ["#small", `frame[${CHILD_FRAME_ID}] >> #wall`]);
  assert.equal(evidence.overlays?.blockers[1]?.blocked.length, 9, "a blocker's covered controls were cut");
});

test("a child frame that does not answer is named on the merged evidence, not dropped silently", async () => {
  const silentChild = 5;
  const merged = await captureMergedTabSnapshot(transportFor(bothFrames, [0, CHILD_FRAME_ID, silentChild]), 7);
  assert.ok(merged, "the merge produced no snapshot");
  assert.deepEqual(merged.evidence?.unansweredFrameIds, [silentChild]);
  // What did answer is all there.
  assert.equal(merged.interactiveElements.length, 3);
});

test("a child frame still working when the wait ends is named too, and the merge does not wait for it past the wait", async () => {
  const slowChild = 6;
  const transport: TabSnapshotTransport = {
    sendToTab: <TResponse = unknown>(_tabId: number, _message: unknown, frameId?: number): Promise<TResponse> =>
      frameId === slowChild
        ? new Promise<TResponse>(() => undefined)
        : Promise.resolve(bothFrames.find((frame) => frame.frameId === (frameId ?? 0))?.snapshot as TResponse),
    allTabFrames: async () => [0, CHILD_FRAME_ID, slowChild].map((frameId) => ({ frameId }) as chrome.webNavigation.GetAllFrameResultDetails)
  };
  const started = Date.now();
  const merged = await captureMergedTabSnapshot(transport, 7, undefined, undefined, { waitMs: 30 });
  assert.ok(Date.now() - started < 2_000, "the merge waited past its wait");
  assert.deepEqual(merged?.evidence?.unansweredFrameIds, [slowChild]);
  assert.equal(merged?.interactiveElements.length, 3);
});

test("a look seeded with the top frame's own snapshot asks the top frame nothing more", async () => {
  const asked: Array<number | undefined> = [];
  const transport: TabSnapshotTransport = {
    sendToTab: async <TResponse = unknown>(_tabId: number, _message: unknown, frameId?: number): Promise<TResponse> => {
      asked.push(frameId);
      return bothFrames.find((frame) => frame.frameId === (frameId ?? 0))?.snapshot as TResponse;
    },
    allTabFrames: async () => [0, CHILD_FRAME_ID].map((frameId) => ({ frameId }) as chrome.webNavigation.GetAllFrameResultDetails)
  };
  const merged = await captureMergedTabSnapshot(transport, 7, topSnapshot(), 0);
  assert.deepEqual(asked, [CHILD_FRAME_ID]);
  assert.deepEqual(merged?.interactiveElements.map((element) => element.selector), ["#pay", `frame[${CHILD_FRAME_ID}] >> #card`, `frame[${CHILD_FRAME_ID}] >> #confirm`]);
  assert.equal(merged?.evidence && "unansweredFrameIds" in merged.evidence, false, "every frame answered, so none is named");
});

// The top frame is read once, beside the frame list, and that reading stands
// for frame 0 whether or not the list names it. The page is still made of the
// same documents when the list omits it, so the merge must say the same thing
// about it as when every frame was listed.

test("a top frame the frame list omits still contributes its elements and its evidence", async () => {
  const merged = await mergeOfListed(bothFrames, [CHILD_FRAME_ID]);
  const evidence = merged.evidence;
  assert.ok(evidence, "the merged snapshot carried no evidence");

  assert.deepEqual(evidence.regions?.map((region) => region.role), ["main", "form"], "the top frame's regions were dropped from the page");
  assert.equal(evidence.elements.changed, 1, "the top frame's element totals were dropped from the page");
  assert.deepEqual(
    merged.interactiveElements.map((element) => element.selector),
    ["#pay", `frame[${CHILD_FRAME_ID}] >> #card`, `frame[${CHILD_FRAME_ID}] >> #confirm`],
    "the top frame's own elements were dropped from the page"
  );
  assert.equal(evidence.elements.returned, merged.interactiveElements.length, "the element totals must count the frames the element list spans");
  assert.deepEqual(evidence.navigation, topSnapshot().evidence?.navigation);
  assert.equal(evidence.loading.documentState, "complete");
});

test("a seeded merge whose frame list never arrived keeps the seed first and the top frame's evidence first", async () => {
  const merged = await captureMergedTabSnapshot(transportFor(bothFrames, []), 7, childSnapshot(), CHILD_FRAME_ID);
  assert.ok(merged, "the merge produced no snapshot");

  assert.deepEqual(
    merged.interactiveElements.map((element) => element.selector),
    [`frame[${CHILD_FRAME_ID}] >> #card`, `frame[${CHILD_FRAME_ID}] >> #confirm`, "#pay"],
    "the frame the event came from leads the element list, and the top frame's elements follow it"
  );
  assert.deepEqual(merged.evidence?.regions?.map((region) => region.role), ["main", "form"], "the top frame's evidence leads the merged collections");
  assert.equal(merged.evidence?.elements.returned, 3);
});

async function mergeOfListed(frames: readonly FrameFixture[], listed: readonly number[]): Promise<DomSnapshotPayload> {
  const merged = await captureMergedTabSnapshot(transportFor(frames, listed), 7);
  assert.ok(merged, "the merge produced no snapshot");
  return merged;
}

/** A descriptor as the content script writes it, flags and all; the domain's input type names only what it reads. */
type WrittenElement = DomSnapshotPayload["interactiveElements"][number] & { frontLayer?: true; leadStatement?: true };

test("an element's frontLayer and leadStatement, and a layer's kind, cross the merge as each frame wrote them", async () => {
  const top = topSnapshot();
  const topStatement: WrittenElement = { tagName: "SPAN", selector: "#count", leadStatement: true };
  top.interactiveElements = [...top.interactiveElements, topStatement];
  const child = childSnapshot();
  const childBanner: WrittenElement = { tagName: "BUTTON", selector: "#decline", frontLayer: true, documentBounds: { x: 8, y: 80, width: 90, height: 24 } };
  child.interactiveElements = [...child.interactiveElements, childBanner];
  const childEvidence = child.evidence;
  assert.ok(childEvidence?.dialogs && childEvidence.overlays);
  childEvidence.dialogs.open = childEvidence.dialogs.open.map((dialog) => ({ ...dialog, kind: "robot_check" as const }));
  childEvidence.overlays.blockers = childEvidence.overlays.blockers.map((blocker) => ({ ...blocker, kind: "consent" as const }));

  const merged = await mergeOf([{ frameId: 0, snapshot: top }, { frameId: CHILD_FRAME_ID, snapshot: child }]);
  const elements = merged.interactiveElements as WrittenElement[];
  const count = elements.find((element) => element.selector === "#count");
  const decline = elements.find((element) => element.selector === `frame[${CHILD_FRAME_ID}] >> #decline`);
  assert.equal(count?.leadStatement, true, "the top frame's statement keeps its flag");
  assert.equal(decline?.frontLayer, true, "a child frame's banner control keeps its flag through the frame translation");
  // Nothing else gains a flag on the way.
  assert.deepEqual(elements.filter((element) => element.frontLayer).map((element) => element.selector), [`frame[${CHILD_FRAME_ID}] >> #decline`]);
  assert.deepEqual(elements.filter((element) => element.leadStatement).map((element) => element.selector), ["#count"]);
  assert.equal(merged.evidence?.dialogs?.open[0]?.kind, "robot_check");
  assert.equal(merged.evidence?.overlays?.blockers[0]?.kind, "consent");
});
