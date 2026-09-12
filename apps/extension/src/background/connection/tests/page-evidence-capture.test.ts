// The extension's half of the page-evidence wire contract, over captures the
// extension did not write.
//
// `dom-snapshot.test.ts` next door proves the cross-frame merge against
// hand-written frames. Hand-written frames are exactly what let five packet
// fields be read at paths no producer wrote for three months: every side had
// tests, and every side's tests built the shape that side expected.
//
// So this file starts from `WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES` in the
// shared contract (`domain/src/page-evidence/capture.ts`) -- snapshots the real
// content-script bundle produced in a real browser -- and drives them through
// the two pieces of extension code that touch page evidence on the way to the
// gateway: `pageEvidenceOf`, which finds it on a snapshot, and
// `captureMergedTabSnapshot`, which folds one per frame into one per tab. The
// domain's projection then reads the result. Producer, merge and consumer are
// joined by data here, not only by a type.
//
// The type join is asserted too, and it is not a formality: `PageEvidence` in
// `content/evidence/types.ts` is an alias of the contract's
// `WebAutomationPageEvidence`, so the assignments below compile only while the
// extension is importing the contract rather than restating it. Restore a local
// declaration and this file stops compiling.

import assert from "node:assert/strict";
import test from "node:test";
import { WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES } from "@fluxiq-web-extension/domain";
import { createWebAutomationStateFromSnapshot } from "@fluxiq-web-extension/domain/client";
import type { PageEvidence } from "../../../shared/protocol";
import { captureMergedTabSnapshot, pageEvidenceOf, type TabSnapshotTransport } from "../dom-snapshot";

const TAB_ID = 11;
const CHILD_FRAME_ID = 3;
const CHILD_PREFIX = `frame[${CHILD_FRAME_ID}] >> `;

// The contract's type, held by the extension's name for it. No cast: if these
// two ever stop being the same type object, the wire has two declarations again.
const MODAL_FLOWS: PageEvidence = WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES["modal-flows"];
const INFINITE_FEED: PageEvidence = WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES["infinite-feed"];

function frameSnapshot(evidence: PageEvidence, isTop: boolean) {
  return {
    url: evidence.navigation.url,
    title: isTop ? "Top document" : "Child document",
    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 },
    frame: isTop ? { isTop: true } : { isTop: false, viewportOffset: { x: 40, y: 200, width: 600, height: 400 } },
    interactiveElements: [{
      tagName: "button",
      selector: isTop ? "button.top" : "button.child",
      text: "Go",
      bounds: { x: 10, y: 10, width: 80, height: 30 },
      documentBounds: { x: 10, y: 10, width: 80, height: 30 }
    }],
    evidence
  };
}

function transportFor(snapshots: Record<number, unknown>): TabSnapshotTransport {
  return {
    sendToTab: async <TResponse = unknown>(_tabId: number, _message: unknown, frameId?: number): Promise<TResponse> =>
      snapshots[frameId ?? 0] as TResponse,
    allTabFrames: async () => Object.keys(snapshots).map((frameId) => ({ frameId: Number(frameId) })) as never
  };
}

async function mergedTab(): Promise<PageEvidence> {
  const merged = await captureMergedTabSnapshot(
    transportFor({ 0: frameSnapshot(MODAL_FLOWS, true), [CHILD_FRAME_ID]: frameSnapshot(INFINITE_FEED, false) }),
    TAB_ID
  );
  assert.ok(merged, "the merge produced no snapshot");
  const evidence = pageEvidenceOf(merged);
  assert.ok(evidence, "the merged snapshot carries no page evidence, so a real capture was dropped in the merge");
  return evidence;
}

test("a real capture survives the trip from the content script's snapshot to the merged tab snapshot", async () => {
  const single = await captureMergedTabSnapshot(transportFor({ 0: frameSnapshot(MODAL_FLOWS, true) }), TAB_ID);
  assert.ok(single);
  const evidence = pageEvidenceOf(single);
  // A single-frame page must come out of the merge exactly as it went in:
  // anything else is the merge inventing or losing a fact on the ordinary path.
  assert.deepEqual(evidence, MODAL_FLOWS);
});

test("two real captures merge into one page without either being flattened away", async () => {
  const evidence = await mergedTab();

  // Additive items fold. The dialog the top frame was showing and the child
  // frame's own state both survive, and the child's selectors are qualified.
  assert.equal(evidence.dialogs?.open.length, MODAL_FLOWS.dialogs?.open.length);
  assert.equal(evidence.dialogs?.open[0]?.label, MODAL_FLOWS.dialogs?.open[0]?.label);
  assert.equal(
    evidence.regions?.length,
    (MODAL_FLOWS.regions?.length ?? 0) + (INFINITE_FEED.regions?.length ?? 0)
  );
  assert.equal(evidence.repeating?.length, INFINITE_FEED.repeating?.length);
  assert.equal(evidence.repeating?.[0]?.containerSelector, `${CHILD_PREFIX}${INFINITE_FEED.repeating?.[0]?.containerSelector}`);

  // The element funnel counts the frames the element list spans, or
  // `elements.returned` reads low against a merged snapshot.
  assert.equal(evidence.elements.scanned, MODAL_FLOWS.elements.scanned + INFINITE_FEED.elements.scanned);
  assert.equal(evidence.elements.matched, MODAL_FLOWS.elements.matched + INFINITE_FEED.elements.matched);

  // Loading merges; the single-document facts do not. The top frame was
  // `complete` and the child was mid-fetch, so the page is complete and busy.
  assert.equal(evidence.loading.documentState, MODAL_FLOWS.loading.documentState);
  assert.equal(evidence.loading.busy, true);
  assert.deepEqual(evidence.loading.busyRegions, INFINITE_FEED.loading.busyRegions.map((selector) => `${CHILD_PREFIX}${selector}`));
  assert.equal(evidence.navigation.url, MODAL_FLOWS.navigation.url, "a child frame's URL is not the page's");
});

test("every item two real captures carried is still readable in web state after the merge", async () => {
  const merged = await captureMergedTabSnapshot(
    transportFor({ 0: frameSnapshot(MODAL_FLOWS, true), [CHILD_FRAME_ID]: frameSnapshot(INFINITE_FEED, false) }),
    TAB_ID
  );
  assert.ok(merged);
  const values = createWebAutomationStateFromSnapshot(merged, { timestamp: 700, sourceId: `tab:${TAB_ID}` }).namespaces.web?.values ?? {};

  // The union of the items the two browsers actually sent, and nothing else.
  const sent = [...new Set([...Object.keys(MODAL_FLOWS), ...Object.keys(INFINITE_FEED)])].sort();
  const projected = [...new Set(
    Object.keys(values)
      .filter((path) => path.startsWith("evidence."))
      .map((path) => path.slice("evidence.".length).split(".")[0] ?? "")
  )].sort();
  assert.deepEqual(projected, sent, "the items the browsers sent and the items web state carries are not the same set");

  // And one value from each end of the merge, so the row above cannot pass on
  // empty collections alone.
  const dialogs = values["evidence.dialogs.open"]?.value as { items: Record<string, unknown>[] };
  assert.equal(dialogs.items[0]?.label, MODAL_FLOWS.dialogs?.open[0]?.label);
  const repeating = values["evidence.repeating"]?.value as { items: Record<string, unknown>[] };
  assert.equal(repeating.items[0]?.itemCount, INFINITE_FEED.repeating?.[0]?.itemCount);
});
