// One capture, both readers, one set of field names.
//
// The page evidence a content script gathers is read twice and independently:
// `recording/web-state/evidence/` projects it into Core state, and
// `runtime/llm-evidence/page-evidence.ts` compacts it into the packet a model
// sees. Neither can import the producer -- the structure audit forbids
// `domain/src` reaching into `apps/extension/src` -- so each restates the wire
// shape it expects, and nothing but a test can hold the two restatements
// together.
//
// Nothing did, and they came apart. The packet read `snapshot.loading`,
// `snapshot.navigation`, `snapshot.dialogs`, `snapshot.blockingOverlay` and
// `snapshot.pendingNativeDialog` at the top level while the producer wrote
// `evidence.loading`, `evidence.navigation`, `evidence.dialogs.open[]`,
// `evidence.overlays.blockers[]` and nothing at all for the last. Every one of
// those packet fields was empty against a real page, so a model looking at a
// modal dialog was told the page was clear -- and both sides' own tests passed,
// because each built the shape its own reader expected.
//
// So this file builds **one** capture and asserts the two readers agree about
// it, in both directions:
//
//  - present: for every page-level item, both readers report it, and they
//    report the same value;
//  - absent: drop one producer field and both readers go quiet together, which
//    is what proves they are keyed off the same name rather than each off its
//    own.
//
// A reader that starts looking somewhere else fails here even if its own file's
// tests are rewritten to match, because the capture below is not written in
// either reader's vocabulary. It is written in the producer's --
// `WebAutomationPageEvidence`, which since `domain/src/page-evidence/` exists is
// the producer's own declaration and not a restatement of it, so the compiler
// checks the fixture as well as the readers.
//
// Two kinds of capture drive the rows below.
//
//  - `WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES` is real: three snapshots taken by
//    the content-script bundle in a real browser. They are what proves the
//    readers are pointed at fields something actually writes, which a shared
//    type cannot prove on its own -- a shape both sides satisfy can be
//    populated by neither.
//  - `pageEvidence` below is constructed, for the four facts no Lab fixture
//    produces: a capture whose element cap already bit, a referrer carrying a
//    query string, a redirect chain, and a back-forward navigation. Its shape
//    is not a guess -- the compiler holds it to the contract -- but its values
//    are chosen, and the rows that use it say so.

import assert from "node:assert/strict";
import test from "node:test";
import type { StateSnapshot, StateValue } from "fluxiq/automation-studio";
import {
  WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES,
  type WebAutomationPageEvidence,
  type WebAutomationPageEvidenceCaptureName
} from "../page-evidence";
import { createWebAutomationStateFromSnapshot, type WebAutomationDomSnapshotInput } from "../recording/web-state";
import { sanitizeWebLlmSnapshot, type WebLlmPageEvidence } from "../runtime/llm-evidence";

/** The four facts no Lab fixture produces, in the contract's own shape. */
const pageEvidence: WebAutomationPageEvidence = {
  elements: { scanned: 4_200, candidates: 900, matched: 812, returned: 2, truncated: true, changed: 1, recentlyInteracted: 1 },
  loading: {
    documentState: "interactive",
    busy: true,
    busyRegions: ["#basket"],
    indicators: [{ selector: "#spinner", kind: "spinner", label: "Updating total" }],
    pendingNavigation: true
  },
  navigation: {
    url: "https://example.test/checkout",
    origin: "https://example.test",
    path: "/checkout",
    referrer: "https://example.test/cart?session=private",
    type: "back_forward",
    redirects: 2,
    historyLength: 4,
    visibility: "visible"
  },
  dialogs: {
    open: [{ selector: "#terms", role: "dialog", modal: true, native: false, label: "Terms of sale" }],
    modal: true
  },
  overlays: {
    tested: 12,
    blockedCount: 2,
    blockers: [{ selector: "#consent", role: "region", label: "We use cookies", blocks: 2, blocked: ["button.pay", "a.help"] }]
  }
};

const snapshot = {
  url: "https://example.test/checkout",
  title: "Checkout",
  viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 },
  selectedText: "Total due",
  interactiveElements: [
    { tagName: "button", selector: "button.pay", visibleText: "Pay", bounds: { x: 20, y: 400, width: 120, height: 40 } },
    { tagName: "input", selector: "input#coupon", name: "Coupon", bounds: { x: 20, y: 300, width: 200, height: 32 } }
  ],
  evidence: pageEvidence
};

type PageEvidenceKey = keyof WebAutomationPageEvidence;
type Collection = { count: number; truncated: boolean; items: Record<string, unknown>[] };

/**
 * The capture with one producer field removed. Used to prove both readers lose
 * the same item together; a reader with a private path keeps reporting.
 */
function captureWithout(...omitted: PageEvidenceKey[]): Record<string, unknown> {
  const evidence = Object.fromEntries(Object.entries(pageEvidence).filter(([key]) => !omitted.includes(key as PageEvidenceKey)));
  return { ...snapshot, evidence };
}

function projected(capture: Record<string, unknown>): Record<string, StateValue> {
  const state: StateSnapshot = createWebAutomationStateFromSnapshot(capture as unknown as WebAutomationDomSnapshotInput, { timestamp: 40, sourceId: "tab:9" });
  return state.namespaces.web?.values ?? {};
}

function packet(capture: Record<string, unknown>): WebLlmPageEvidence {
  return sanitizeWebLlmSnapshot(capture);
}

function collection(values: Record<string, StateValue>, path: string): Collection {
  return values[path]?.value as unknown as Collection;
}

test("both readers see the same dialog, under the producer's own field names", () => {
  const values = projected(snapshot);
  const evidence = packet(snapshot);
  const open = collection(values, "evidence.dialogs.open").items[0];
  const carried = evidence.dialogs?.[0];
  assert.ok(carried, "the packet reported no dialog at all: it is reading a path the producer does not write");
  assert.equal(values["evidence.dialogs.openCount"]?.value, 1);
  assert.equal(carried.selector, open?.selector);
  assert.equal(carried.role, open?.role);
  // The producer calls a dialog's accessible name `label`; the packet calls one
  // `name`, as it does on an element. One fact, and this is where the rename is
  // pinned.
  assert.equal(carried.name, open?.label);
  assert.equal(carried.modal, true);
  assert.equal(values["evidence.dialogs.modal"]?.value, true);
});

test("both readers see the same blocking overlay, and the packet takes the one the producer ranked first", () => {
  const values = projected(snapshot);
  const evidence = packet(snapshot);
  const blocker = collection(values, "evidence.overlays.blockers").items[0];
  assert.ok(evidence.blockedBy, "the packet reported nothing covering the page");
  assert.equal(evidence.blockedBy.selector, blocker?.selector);
  assert.equal(evidence.blockedBy.role, blocker?.role);
  assert.equal(evidence.blockedBy.name, blocker?.label);
  assert.equal(evidence.blockedBy.blocks, blocker?.blocks);
  assert.equal(values["evidence.overlays.blockedCount"]?.value, 2);
});

test("both readers see the same loading state, including which kind of indicator is on screen", () => {
  const values = projected(snapshot);
  const evidence = packet(snapshot);
  assert.ok(evidence.loading, "the packet reported nothing about a page still settling");
  assert.equal(evidence.loading.readyState, values["evidence.loading.documentState"]?.value);
  assert.equal(evidence.loading.busy, values["evidence.loading.busy"]?.value);
  assert.equal(evidence.loading.pendingNavigation, values["evidence.loading.pendingNavigation"]?.value);
  const kinds = collection(values, "evidence.loading.indicators").items.map((item) => item.kind);
  assert.equal(evidence.loading.spinner, kinds.includes("spinner") ? true : undefined);
});

test("both readers see the same navigation facts, and the packet strips the query the state keeps", () => {
  const values = projected(snapshot);
  const evidence = packet(snapshot);
  assert.ok(evidence.navigation, "the packet reported nothing about how the page was reached");
  assert.equal(evidence.navigation.type, values["evidence.navigation.type"]?.value);
  assert.equal(evidence.navigation.redirects, values["evidence.navigation.redirects"]?.value);
  const referrer = new URL(String(values["evidence.navigation.referrer"]?.value));
  assert.equal(evidence.navigation.referrer, `${referrer.origin}${referrer.pathname}`);
  assert.doesNotMatch(JSON.stringify(evidence), /session=private/u, "the packet must not carry a query string");
});

test("both readers see the same element funnel, so the model is told what the browser already cut", () => {
  const values = projected(snapshot);
  const evidence = packet(snapshot);
  assert.equal(evidence.elementTotal, values["evidence.elements.matched"]?.value);
  assert.equal(evidence.captureTruncated, values["evidence.elements.truncated"]?.value);
  assert.equal(evidence.truncated, true);
  // The same fact outside the `evidence.` prefix, for a consumer reading the
  // element summary rather than the funnel.
  assert.equal(values["elements.captureTruncated"]?.value, true);
});

// The direction that catches a reader with a path of its own. Removing one
// producer field must silence both readers; if one keeps reporting, it is
// reading something the producer did not write.
test("dropping one producer field silences both readers together", () => {
  const rows: { key: PageEvidenceKey; statePrefix: string; carried: (evidence: WebLlmPageEvidence) => unknown }[] = [
    { key: "loading", statePrefix: "evidence.loading.", carried: (evidence) => evidence.loading },
    { key: "navigation", statePrefix: "evidence.navigation.", carried: (evidence) => evidence.navigation },
    { key: "dialogs", statePrefix: "evidence.dialogs.", carried: (evidence) => evidence.dialogs },
    { key: "overlays", statePrefix: "evidence.overlays.", carried: (evidence) => evidence.blockedBy }
  ];
  for (const row of rows) {
    const capture = captureWithout(row.key);
    const paths = Object.keys(projected(capture)).filter((path) => path.startsWith(row.statePrefix));
    assert.deepEqual(paths, [], `the projection still wrote ${row.statePrefix}* without ${row.key}`);
    assert.equal(row.carried(packet(capture)), undefined, `the packet still reported ${row.key} the producer did not send`);
    // And with the field back, both report again -- otherwise the row above
    // would pass for a reader that reports nothing at all, ever.
    assert.notEqual(row.carried(packet(snapshot)), undefined, `the packet never reports ${row.key}`);
  }
});

test("a capture with no page evidence at all costs nothing on either side", () => {
  const bare = { ...snapshot, evidence: undefined };
  const paths = Object.keys(projected(bare)).filter((path) => path.startsWith("evidence."));
  assert.deepEqual(paths, []);
  const evidence = packet(bare);
  assert.deepEqual(
    { loading: evidence.loading, navigation: evidence.navigation, dialogs: evidence.dialogs, blockedBy: evidence.blockedBy, elementTotal: evidence.elementTotal },
    { loading: undefined, navigation: undefined, dialogs: undefined, blockedBy: undefined, elementTotal: undefined }
  );
  assert.equal(evidence.truncated, false);
  // The page's own facts still arrive: it is the evidence that is absent, not the capture.
  assert.equal(evidence.elements.length, 2);
  assert.equal(evidence.selectedText, "Total due");
});

// ---------------------------------------------------------------------------
// The same two readers, over captures nobody wrote.
//
// Everything above is driven by a constructed capture. It is now compiler-held
// to the contract, which is a real improvement on a fixture written from
// memory -- but a shape both sides satisfy can still be populated by neither,
// and that is exactly the hole the last three defects fell through. So the rows
// below drive the same readers over `page-evidence/capture.ts`: snapshots the
// real content-script bundle produced in a real browser, on named Scenario Lab
// fixtures, and pasted in unedited. Nothing here chose the field names, the
// nesting, or the values.

/** A snapshot built around one real capture: the page it came from, and its evidence. */
function realSnapshot(name: WebAutomationPageEvidenceCaptureName): Record<string, unknown> {
  const evidence = WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES[name];
  return {
    url: evidence.navigation.url,
    title: name,
    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 },
    interactiveElements: [{ tagName: "button", selector: "button.only", visibleText: "Only element" }],
    evidence
  };
}

test("real capture: the modal a page was actually showing reaches both readers", () => {
  const capture = realSnapshot("modal-flows");
  const evidence = WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES["modal-flows"];
  const values = projected(capture);
  const packeted = packet(capture);

  const open = collection(values, "evidence.dialogs.open").items[0];
  const carried = packeted.dialogs?.[0];
  assert.ok(carried, "the packet reported no dialog, and a real browser sent one");
  assert.equal(values["evidence.dialogs.openCount"]?.value, evidence.dialogs?.open.length);
  assert.equal(carried.selector, open?.selector);
  assert.equal(carried.role, open?.role);
  // The producer's word is `label` and the packet's is `name`. One fact, and
  // the browser's own value is what pins the rename.
  assert.equal(carried.name, open?.label);
  assert.equal(carried.name, evidence.dialogs?.open[0]?.label);
  assert.equal(carried.modal, true);
  assert.equal(values["evidence.dialogs.modal"]?.value, true);

  // The native confirm the page-world override answered, carried as history by
  // the projection and deliberately not by the packet.
  const lastNative = values["evidence.dialogs.lastNative"]?.value as Record<string, unknown>;
  assert.equal(lastNative?.kind, evidence.dialogs?.lastNative?.kind);
  assert.equal(lastNative?.response, evidence.dialogs?.lastNative?.response);
});

test("real capture: what the page painted over its controls reaches both readers", () => {
  const capture = realSnapshot("modal-flows");
  const evidence = WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES["modal-flows"];
  const values = projected(capture);
  const blockedBy = packet(capture).blockedBy;
  const blocker = collection(values, "evidence.overlays.blockers").items[0];
  assert.ok(blockedBy, "the packet reported nothing covering a page whose every control was behind a backdrop");
  assert.equal(blockedBy.selector, blocker?.selector);
  assert.equal(blockedBy.selector, evidence.overlays?.blockers[0]?.selector);
  assert.equal(blockedBy.blocks, blocker?.blocks);
  assert.equal(values["evidence.overlays.blockedCount"]?.value, evidence.overlays?.blockedCount);
  assert.equal(values["evidence.overlays.tested"]?.value, evidence.overlays?.tested);
  // The blocker carries neither a role nor an accessible name -- it is a bare
  // backdrop div -- so neither reader may invent one.
  assert.equal(blockedBy.role, undefined);
  assert.equal(blockedBy.name, undefined);
});

test("real capture: a page caught mid-fetch is reported busy by both readers, with the kind of indicator it really had", () => {
  const capture = realSnapshot("infinite-feed");
  const evidence = WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES["infinite-feed"];
  const values = projected(capture);
  const loading = packet(capture).loading;
  assert.ok(loading, "the packet said nothing about a page that was still fetching");
  assert.equal(loading.busy, values["evidence.loading.busy"]?.value);
  assert.equal(loading.busy, true);
  // readyState is `complete` while the page fetches more, so the packet omits
  // it and `busy` is the whole signal. That is the producer's answer, not a
  // reader's convention.
  assert.equal(values["evidence.loading.documentState"]?.value, "complete");
  assert.equal(loading.readyState, undefined);
  // The page's live region says "Loading more posts", which is a `status` and
  // not a spinner; the packet must not promote it.
  assert.deepEqual(
    collection(values, "evidence.loading.indicators").items.map((item) => item.kind),
    evidence.loading.indicators.map((indicator) => indicator.kind)
  );
  assert.equal(loading.spinner, undefined);
  assert.deepEqual(
    collection(values, "evidence.loading.busyRegions").items,
    evidence.loading.busyRegions.map((selector) => ({ selector }))
  );
});

test("real capture: the sensitive controls a real form carried are named to both readers and their contents reach neither", () => {
  const capture = realSnapshot("sensitive-input");
  const evidence = WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES["sensitive-input"];
  const values = projected(capture);
  const form = collection(values, "evidence.forms").items[0];
  const controls = form?.controls as Record<string, unknown>[];
  assert.equal(controls.length, evidence.forms?.[0]?.controls.length);
  const card = controls.find((control) => control.selector === "[data-testid=\"billing\"]");
  assert.ok(card, "the billing card field is missing from the projection, so a reader cannot know it is there");
  assert.equal(card.sensitive, true);
  assert.equal(card.hasValue, undefined, "nothing derived from what was typed into a card field travels");
  // The packet carries page-level evidence and elements, never the forms model,
  // so no control of any kind reaches it from here.
  assert.doesNotMatch(JSON.stringify(packet(capture)), /billing|cc-number/u);
});

// The generic direction, over data. Every item a real browser sent must be
// projected, and no `evidence.*` path may exist for an item it did not send.
// This is the assertion that would have failed on the day the packet started
// reading `snapshot.loading`, and the one that catches the next item added to
// the producer and forgotten by the projection.
test("real captures: every item the browser sent is projected, and nothing else is", () => {
  for (const name of Object.keys(WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES) as WebAutomationPageEvidenceCaptureName[]) {
    const evidence = WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES[name];
    const sent = Object.keys(evidence).sort();
    const projectedItems = [...new Set(
      Object.keys(projected(realSnapshot(name)))
        .filter((path) => path.startsWith("evidence."))
        .map((path) => path.slice("evidence.".length).split(".")[0] ?? "")
    )].sort();
    assert.deepEqual(projectedItems, sent, `${name}: the items the browser sent and the items the projection wrote are not the same set`);
  }
});
