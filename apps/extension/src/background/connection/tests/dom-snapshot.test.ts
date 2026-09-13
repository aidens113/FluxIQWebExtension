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

// The merged element list is bounded, and says so when the bound bites.
//
// Every other collection the merge produces has had a cross-frame budget since
// the merge was written; the element list -- the largest of them -- had none.
// The Lab's only multi-frame fixture holds six elements per frame, so nothing
// in the corpus could show it: a real page carrying a dozen ad, chat and
// payment frames can offer `MAX_SNAPSHOT_CANDIDATES` (2,000) from each, to a
// payload rebuilt on every recorded event.
//
// What is pinned here is the bound, where the bound cuts, and that the cut is
// reported through the flag the per-frame element cap already sets rather than
// through a new one -- `evidence.elements.truncated`, with `matched` left at
// the pre-cap total so `matched - returned` still says how many went missing.

/** `MAX_MERGED_ELEMENTS` in the module under test. */
const MERGED_ELEMENT_BOUND = 4_000;

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

test("the merged element list is bounded across frames, as every collection beside it is", async () => {
  // 1,000 from the page and 1,500 from each of three frames: 5,500 offered.
  const frames = [crowdedFrame(0, 1_000), crowdedFrame(1, 1_500), crowdedFrame(2, 1_500), crowdedFrame(3, 1_500)];
  const merged = await mergeOf(frames);

  assert.equal(merged.interactiveElements.length, MERGED_ELEMENT_BOUND, "the merged element list is unbounded");
  // The cap takes a prefix, so what survives is what answered first and what is
  // dropped is the tail -- here the whole of the last frame. Order across
  // frames is the merge's existing rule (seed frame first, then answer order),
  // not something this cap chose; it only decides who the cap reaches.
  assert.equal(merged.interactiveElements[0]?.selector, "#f0-e0");
  assert.equal(
    merged.interactiveElements.some((element) => element.selector?.startsWith("frame[3]")),
    false,
    "the cap must drop the tail of the merged list, not thin it out"
  );
});

test("what the merged cap dropped is reported, not silently absent", async () => {
  const frames = [crowdedFrame(0, 1_000), crowdedFrame(1, 1_500), crowdedFrame(2, 1_500), crowdedFrame(3, 1_500)];
  const evidence = await mergedEvidence(frames);

  assert.equal(evidence.elements.returned, MERGED_ELEMENT_BOUND, "returned must count the elements the payload carries");
  assert.equal(evidence.elements.matched, 5_500, "matched stays the pre-cap total, so the drop is readable");
  assert.equal(evidence.elements.truncated, true, "the capture's own truncation flag is what a merged drop sets");
});

test("a merge under the bound is untouched by it", async () => {
  const frames = [crowdedFrame(0, 10), crowdedFrame(1, 10)];
  const merged = await mergeOf(frames);

  assert.equal(merged.interactiveElements.length, 20);
  assert.equal(merged.evidence?.elements.returned, 20);
  assert.equal(merged.evidence?.elements.truncated, false);
});

// The fallback path: the top frame is read once on its own before the frame
// list is asked for, and that reading stands in for the top frame when no
// listed frame is it -- the list omitted frame 0, or frame 0 did not answer its
// second read in time. The page is still made of the same documents, so the
// merge must say the same thing about it as when every frame was listed.

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
