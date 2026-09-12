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
  type DomSnapshotPayloadWithEvidence,
  type TabSnapshotTransport
} from "../dom-snapshot";
import type { PageEvidence, RectDescriptor } from "../../../shared/protocol";

type FrameFixture = { frameId: number; snapshot: DomSnapshotPayloadWithEvidence };

const CHILD_FRAME_ID = 2;
// The iframe's box in the top frame's viewport, and the top frame's own scroll,
// so a translated rect is visibly neither of the two source coordinates.
const CHILD_VIEWPORT_OFFSET: RectDescriptor = { x: 100, y: 50, width: 400, height: 300 };
const TOP_SCROLL_Y = 20;

function transportFor(frames: readonly FrameFixture[]): TabSnapshotTransport {
  return {
    sendToTab: async <TResponse = unknown>(_tabId: number, _message: unknown, frameId?: number): Promise<TResponse> =>
      frames.find((frame) => frame.frameId === (frameId ?? 0))?.snapshot as TResponse,
    allTabFrames: async () => frames.map((frame) => ({ frameId: frame.frameId }) as chrome.webNavigation.GetAllFrameResultDetails)
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

function topSnapshot(): DomSnapshotPayloadWithEvidence {
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

function childSnapshot(): DomSnapshotPayloadWithEvidence {
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

async function mergeOf(frames: readonly FrameFixture[]): Promise<DomSnapshotPayloadWithEvidence> {
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
