// The recording evidence pipeline `connection.ts` runs, end to end in one
// process: the snapshot a content script produces, the background worker's
// cross-frame merge of it, and the domain's state projection of the result.
//
// Each of the three was tested on its own and the chain between them was not,
// which is how the evidence came to be produced, merged, and then silently
// dropped -- `createWebAutomationStateFromSnapshot` read a fixed list of six
// fields and `evidence` was not among them. A test that calls the projection
// directly proves the projection; only this one proves that what the merge
// builds is what the projection is given and that it survives the trip.
//
// The frame snapshots are hand-written rather than captured from a browser, so
// what is proven here is the joinery, not the browser behaviour those snapshots
// stand for; `e2e/content/tests/evidence.spec.ts` covers the producer on real
// pages.

import assert from "node:assert/strict";
import test from "node:test";
import { createWebAutomationStateFromSnapshot } from "@fluxiq-web-extension/domain/client";
import type { RecordingEventPayload } from "../../shared/protocol";
import { captureMergedTabSnapshot, gatewayRecordingEventFromPayload, type TabSnapshotTransport } from "../connection/index";

const TAB_ID = 7;
const CHILD_FRAME_ID = 1;
const CHILD_PREFIX = `frame[${CHILD_FRAME_ID}] >> `;
/** A value the content script was supposed to have withheld. The card field carries one anyway. */
const LEAKED = "synthetic-value-the-producer-should-have-withheld";

// A checkout page whose card details are collected in a payment iframe: the
// shape that makes the merge worth having, because everything a reader needs
// to decide whether it may act is in the frame and everything naming the page
// is outside it.
function topFrameSnapshot() {
  return {
    url: "https://shop.test/checkout",
    title: "Checkout",
    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 60 },
    frame: { isTop: true },
    interactiveElements: [{ tagName: "button", selector: "button.pay", text: "Pay", bounds: { x: 40, y: 600, width: 160, height: 44 }, documentBounds: { x: 40, y: 660, width: 160, height: 44 } }],
    evidence: {
      elements: { scanned: 180, candidates: 60, matched: 9, returned: 1, truncated: false, changed: 0, recentlyInteracted: 0 },
      loading: { documentState: "complete", busy: false, busyRegions: [], indicators: [], pendingNavigation: false },
      navigation: { url: "https://shop.test/checkout", origin: "https://shop.test", path: "/checkout", referrer: "https://shop.test/cart", type: "navigate", redirects: 0, historyLength: 3, visibility: "visible" },
      regions: [{ role: "main", label: "Checkout", selector: "main", bounds: { x: 0, y: 120, width: 1280, height: 900 } }]
    }
  };
}

function childFrameSnapshot() {
  return {
    url: "https://payments.test/card",
    title: "Card details",
    viewport: { width: 600, height: 400, scrollX: 0, scrollY: 0 },
    frame: { isTop: false, viewportOffset: { x: 40, y: 200, width: 600, height: 400 } },
    interactiveElements: [{
      tagName: "input",
      selector: "#card",
      inputType: "password",
      name: "Card number",
      attributes: { name: "card", type: "password" },
      value: LEAKED,
      bounds: { x: 20, y: 40, width: 300, height: 32 },
      documentBounds: { x: 20, y: 40, width: 300, height: 32 }
    }],
    evidence: {
      elements: { scanned: 40, candidates: 12, matched: 4, returned: 1, truncated: true, changed: 2, recentlyInteracted: 1 },
      loading: { documentState: "loading", busy: true, busyRegions: ["#card-status"], indicators: [{ selector: "#spinner", kind: "spinner", label: "Checking card" }], pendingNavigation: true },
      navigation: { url: "https://payments.test/card", origin: "https://payments.test", path: "/card", historyLength: 1, visibility: "visible" },
      dialogs: {
        open: [{ selector: "#confirm", role: "alertdialog", modal: true, native: false, label: "Confirm payment", bounds: { x: 10, y: 10, width: 200, height: 120 } }],
        modal: true
      },
      overlays: { tested: 4, blockedCount: 1, blockers: [{ selector: "#veil", label: "Verifying", bounds: { x: 0, y: 0, width: 600, height: 400 }, blocks: 1, blocked: ["#card"] }] },
      regions: [{ role: "form", label: "Card details", selector: "form#card-form", bounds: { x: 0, y: 0, width: 600, height: 400 } }],
      forms: [{
        selector: "form#card-form",
        label: "Card details",
        action: "/charge",
        method: "post",
        controlCount: 2,
        controls: [
          { selector: "#name", controlType: "text", name: "name", label: "Name on card", required: true, hasValue: true },
          { selector: "#card", controlType: "password", name: "card", label: "Card number", required: true, hasValue: true, sensitive: true }
        ],
        submit: "button.submit-card"
      }]
    }
  };
}

function transportFor(snapshots: Record<number, unknown>): TabSnapshotTransport {
  return {
    sendToTab: async <TResponse = unknown>(_tabId: number, _message: unknown, frameId?: number): Promise<TResponse> =>
      snapshots[frameId ?? 0] as TResponse,
    allTabFrames: async () => Object.keys(snapshots).map((frameId) => ({ frameId: Number(frameId) })) as never
  };
}

/** The tab as the recording path sees it after an input inside the payment iframe. */
async function projectedTabState(): Promise<Record<string, { value?: unknown }>> {
  const merged = await captureMergedTabSnapshot(
    transportFor({ 0: topFrameSnapshot(), [CHILD_FRAME_ID]: childFrameSnapshot() }),
    TAB_ID,
    childFrameSnapshot() as never,
    CHILD_FRAME_ID
  );
  assert.ok(merged, "the merge produced no snapshot");
  const state = createWebAutomationStateFromSnapshot(merged, { timestamp: 500, sourceId: `tab:${TAB_ID}` });
  return (state.namespaces.web?.values ?? {}) as Record<string, { value?: unknown }>;
}

type Collection = { count: number; truncated: boolean; items: Record<string, unknown>[] };

test("a child frame's evidence reaches web state through the merge and the projection", async () => {
  const values = await projectedTabState();

  const dialogs = values["evidence.dialogs.open"]?.value as Collection;
  assert.equal(values["evidence.dialogs.openCount"]?.value, 1, "the payment iframe's dialog is a dialog on the page");
  assert.equal(values["evidence.dialogs.modal"]?.value, true);
  assert.equal(dialogs.items[0]?.selector, `${CHILD_PREFIX}#confirm`, "qualified by its frame, as the merged element list is");
  assert.deepEqual(dialogs.items[0]?.bounds, { x: 50, y: 270, width: 200, height: 120 }, "placed on the top frame's page, not left frame-local");

  const forms = values["evidence.forms"]?.value as Collection;
  assert.equal(forms.items[0]?.selector, `${CHILD_PREFIX}form#card-form`);
  const controls = forms.items[0]?.controls as Record<string, unknown>[];
  assert.equal(controls[0]?.label, "Name on card");
  assert.equal(controls[0]?.hasValue, true);
  assert.equal(controls[1]?.sensitive, true, "the card field is still named, so a reader knows it is there");
  assert.equal(controls[1]?.hasValue, undefined, "and nothing derived from what was typed into it travels");

  const regions = values["evidence.regions"]?.value as Collection;
  assert.deepEqual(regions.items.map((region) => region.selector), ["main", `${CHILD_PREFIX}form#card-form`], "the page's landmarks span its documents");
  assert.equal((values["evidence.overlays.blockers"]?.value as Collection).items[0]?.selector, `${CHILD_PREFIX}#veil`);
  assert.deepEqual((values["evidence.loading.busyRegions"]?.value as Collection).items, [{ selector: `${CHILD_PREFIX}#card-status` }]);

  assert.equal(values["evidence.elements.scanned"]?.value, 220, "the totals count the frames the element list spans");
  assert.equal(values["evidence.elements.returned"]?.value, 2);
  assert.equal(values["evidence.elements.recentlyInteracted"]?.value, 1);
  assert.equal(values["evidence.loading.busy"]?.value, true, "the page is working while any of its documents is");
  assert.equal(values["evidence.loading.documentState"]?.value, "complete", "but readyState belongs to the top document");
  assert.equal(values["evidence.navigation.origin"]?.value, "https://shop.test", "the payment iframe's origin is not the page's");
  assert.equal(values["page.url"]?.value, "https://shop.test/checkout");
});

test("the browser's own element cap reaches the state path a consumer already reads", async () => {
  const values = await projectedTabState();
  assert.equal(values["elements.count"]?.value, 2, "the merged element list spans both frames");
  assert.equal(values["elements.captured"]?.value, 2, "the projection's filter dropped nothing");
  assert.equal(values["elements.truncated"]?.value, true, "the child frame had already dropped elements before sending");
  assert.equal(values["evidence.elements.truncated"]?.value, true);
});

test("nothing typed into the payment iframe appears anywhere in the projected state", async () => {
  const values = await projectedTabState();
  assert.equal(JSON.stringify(values).includes(LEAKED), false, "the card field's value is planted on both the descriptor and the form control");
  const card = Object.values(values)
    .map((entry) => entry.value as Record<string, unknown> | undefined)
    .find((value) => value?.selector === `${CHILD_PREFIX}#card`);
  assert.ok(card, "the control itself is still described, under the same frame-qualified selector as the evidence");
  assert.equal(card?.value, undefined, "only what was typed into it is missing");
});

// The proof Task 2 turns on. The recording event carries the content script's
// own frame-local snapshot and the merged one is recovered a line later; before
// the two are swapped, an ordinary single-frame page has to be provably
// unaffected, because the swap changes what goes on the wire for every recorded
// event. This is the frame-local half of that comparison, so a later change can
// be measured against it rather than argued about.
test("on a single-frame page the merged snapshot builds a byte-identical recording event", async () => {
  const only = topFrameSnapshot();
  const merged = await captureMergedTabSnapshot(transportFor({ 0: only }), TAB_ID, only as never, 0);
  const payload = {
    kind: "dom.click",
    sequence: 4,
    url: only.url,
    title: only.title,
    eventTimestampMs: 900,
    element: { tagName: "button", selector: "button.pay", text: "Pay" }
  } as unknown as RecordingEventPayload;
  const frameLocal = gatewayRecordingEventFromPayload({ ...payload, snapshot: only as never }, TAB_ID, 0, "rec-1");
  const tabMerged = gatewayRecordingEventFromPayload({ ...payload, snapshot: merged as never }, TAB_ID, 0, "rec-1");
  assert.equal(JSON.stringify(tabMerged), JSON.stringify(frameLocal));
});
