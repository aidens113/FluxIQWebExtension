// The page-level evidence items of Phase 1.4 steps 2 and 3.
//
// Every fixture below is written in the **producer's** shape -- the nested
// `evidence` object `apps/extension/src/content/evidence/` puts on a snapshot,
// field for field as its `types.ts` declares it. That is the whole point of
// this file now. The rows it replaced built the flat shape the reader happened
// to expect (`snapshot.loading`, `snapshot.dialogs`, `snapshot.blockingOverlay`
// ...), so they passed while every one of those fields was empty against a real
// capture and the model was handed nothing.
//
// These rows pin the reader against the producer's names. The join itself --
// one capture driven into this reader and into the state projection together,
// so neither side can be renamed alone -- is
// `domain/src/tests/page-evidence-joinery.test.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWebLlmSnapshot } from "..";

const page = (evidence: Record<string, unknown>, extra: Record<string, unknown> = {}): Record<string, unknown> => {
  const snapshot: Record<string, unknown> = {
    url: "https://example.test/checkout",
    title: "Checkout",
    interactiveElements: [{ tagName: "button", selector: "#place-order", visibleText: "Place order" }],
    ...extra
  };
  // A fixture that passes no evidence must carry no `evidence` key at all --
  // an empty object is a different snapshot from one the producer never wrote.
  if (Object.keys(evidence).length) snapshot.evidence = evidence;
  return snapshot;
};

test("reports every open dialog the producer lists, by the producer's own field names", () => {
  const evidence = sanitizeWebLlmSnapshot(page({
    dialogs: {
      open: [
        { selector: "#confirm-dialog", role: "dialog", modal: true, native: false, label: "Confirm your order" },
        { selector: "#session", role: "alertdialog", modal: false, native: false, label: "Session expiring" },
        { selector: "", role: "", modal: false, native: false },
        { selector: "#fourth", role: "dialog", modal: false, native: false, label: "Once beyond the cap" }
      ],
      modal: true
    }
  }));
  // `label` is what the producer calls the dialog's accessible name; `name` is
  // what the packet calls one, on a dialog as on an element. Every dialog that
  // says anything is listed (t200); the packet used to stop at three.
  assert.deepEqual(evidence.dialogs, [
    { role: "dialog", name: "Confirm your order", modal: true },
    { role: "alertdialog", name: "Session expiring" },
    { role: "dialog", name: "Once beyond the cap" }
  ]);
});

test("reports every blocking overlay, most-blocking first, so a click that cannot land is explicable", () => {
  const evidence = sanitizeWebLlmSnapshot(page({
    overlays: {
      tested: 24,
      blockedCount: 2,
      blockers: [
        { selector: "#cookie-wall", role: "dialog", label: "We use cookies", blocks: 2, blocked: ["#place-order", "a.help"] },
        { selector: "#cookie-wall h2", role: "heading", label: "Cookies", blocks: 1, blocked: ["#place-order"] }
      ]
    }
  }));
  // The producer orders its blockers most-blocking first. Every one is listed
  // (t200): the packet used to name only the head.
  assert.deepEqual(evidence.blockedBy, [{ role: "dialog", name: "We use cookies", blocks: 2 }, { role: "heading", name: "Cookies", blocks: 1 }]);
  // The blocker is described, never addressed: a model's answer to an overlay is
  // to say it is there, not to be handed a way to reach into it.
  assert.doesNotMatch(JSON.stringify(evidence.blockedBy), /cookie-wall/u);
  assert.deepEqual(sanitizeWebLlmSnapshot(page({ overlays: { blockers: [{ label: "named only" }] } })).blockedBy, [{ name: "named only" }]);
  assert.equal(sanitizeWebLlmSnapshot(page({ overlays: { blockers: [{ selector: "#anonymous" }] } })).blockedBy, undefined);
  assert.equal(sanitizeWebLlmSnapshot(page({ overlays: { tested: 24, blockedCount: 0, blockers: [] } })).blockedBy, undefined);
});

test("reports loading state only while the page is still settling", () => {
  assert.deepEqual(
    sanitizeWebLlmSnapshot(page({
      loading: {
        documentState: "interactive",
        busy: true,
        busyRegions: ["#cart"],
        indicators: [{ selector: "#spinner", kind: "spinner", label: "Loading more" }],
        pendingNavigation: true
      }
    })).loading,
    { readyState: "interactive", busy: true, indicators: [{ kind: "spinner", label: "Loading more" }], pendingNavigation: true }
  );
  // A settled page with nothing pending says nothing, and costs nothing.
  assert.equal(
    sanitizeWebLlmSnapshot(page({ loading: { documentState: "complete", busy: false, busyRegions: [], indicators: [], pendingNavigation: false } })).loading,
    undefined
  );
  assert.equal(sanitizeWebLlmSnapshot(page({ loading: { documentState: "wat" } })).loading, undefined);
  assert.deepEqual(sanitizeWebLlmSnapshot(page({ loading: { documentState: "loading" } })).loading, { readyState: "loading" });
  // A live region saying "Loading more posts" is a `status`, not a spinner:
  // the producer distinguishes the kinds, and the packet carries the kind and
  // what it says, never the selector.
  assert.deepEqual(
    sanitizeWebLlmSnapshot(page({ loading: { documentState: "complete", busy: true, indicators: [{ selector: "#more", kind: "status", label: "Loading more posts" }] } })).loading,
    { busy: true, indicators: [{ kind: "status", label: "Loading more posts" }] }
  );
});

test("reports how the document was reached, with its URLs whole but for their secrets", () => {
  const evidence = sanitizeWebLlmSnapshot(page({
    navigation: {
      url: "https://example.test/checkout",
      origin: "https://example.test",
      path: "/checkout",
      referrer: "https://example.test/cart?session=private",
      type: "back_forward",
      redirects: 2,
      historyLength: 4,
      visibility: "visible"
    }
  }));
  assert.deepEqual(evidence.navigation, { url: "https://example.test/checkout", type: "back_forward", redirects: 2, referrer: "https://example.test/cart?session=(withheld)" });
  assert.doesNotMatch(JSON.stringify(evidence), /session=private/u);
  // An ordinary visit with no redirects and no referrer says only where it is.
  assert.deepEqual(
    sanitizeWebLlmSnapshot(page({ navigation: { url: "https://example.test/checkout", origin: "https://example.test", path: "/checkout", type: "navigate", redirects: 0, historyLength: 1, visibility: "visible" } })).navigation,
    { url: "https://example.test/checkout" }
  );
  assert.equal(sanitizeWebLlmSnapshot(page({ navigation: { referrer: "javascript:alert(1)" } })).navigation, undefined);
});

test("says when the capture itself left elements out, and the packet has no limit of its own to report", () => {
  const declared = sanitizeWebLlmSnapshot(page({}, { elementTotal: 812, truncated: true }));
  assert.equal(declared.truncated, true);
  assert.equal(declared.captureTruncated, true, "the capture cut, so the capture is where the remedy is");
  for (const retired of ["elementTotal", "elementsTruncated", "budgetTruncated"]) assert.equal(retired in declared, false, retired);
  assert.equal(sanitizeWebLlmSnapshot(page({})).truncated, false);
  assert.equal(sanitizeWebLlmSnapshot(page({})).captureTruncated, undefined);
});

// The content script reports its element funnel at `evidence.elements`, and
// the packet used to read only a bare top-level `truncated`. Against the real
// producer that made the capture limit dead: a page whose tail had already
// been dropped in the browser reached the model as `truncated: false`.
test("reads the capture's own funnel, not only a bare top-level flag", () => {
  const nested = sanitizeWebLlmSnapshot(page({
    elements: { scanned: 4_200, candidates: 900, matched: 812, returned: 40, truncated: true, changed: 3, recentlyInteracted: 1 }
  }));
  assert.equal(nested.captureTruncated, true);
  assert.equal(nested.truncated, true);

  const settled = sanitizeWebLlmSnapshot(page({
    elements: { scanned: 90, candidates: 12, matched: 1, returned: 1, truncated: false, changed: 0, recentlyInteracted: 0 }
  }));
  assert.equal(settled.captureTruncated, undefined);
  assert.equal(settled.truncated, false);
});

test("carries element-level recency and change flags as fields, not as ordering alone", () => {
  const evidence = sanitizeWebLlmSnapshot(page({}, {
    interactiveElements: [
      { tagName: "input", selector: "#quantity", name: "Quantity", recentlyInteracted: true, changed: true },
      { tagName: "button", selector: "#place-order", visibleText: "Place order", recentlyInteracted: false, changed: false }
    ]
  }));
  assert.deepEqual(evidence.elements, [
    { target: "target.1", tag: "input", name: "Quantity", recent: true, changed: true },
    { target: "target.2", tag: "button", text: "Place order" }
  ]);
});

// The defect this file exists to keep fixed. Everything below is the shape the
// reader was written against and no producer has ever emitted; if any of it
// starts being honoured again, a second wrong shape is back in the packet and
// a producer rename can once more go unnoticed.
test("the flat shape the reader was first written against is not read at all", () => {
  const evidence = sanitizeWebLlmSnapshot(page({}, {
    loading: { readyState: "interactive", busy: true, spinner: true, pendingNavigation: true },
    navigation: { pending: true, from: "https://example.test/cart", to: "https://example.test/checkout" },
    dialogs: [{ role: "dialog", name: "Confirm your order", modal: true }],
    blockingOverlay: { selector: "#cookie-wall", tagName: "DIV", role: "dialog", name: "We use cookies" },
    pendingNativeDialog: true
  }));
  assert.deepEqual(
    { loading: evidence.loading, navigation: evidence.navigation, dialogs: evidence.dialogs, blockedBy: evidence.blockedBy },
    { loading: undefined, navigation: undefined, dialogs: undefined, blockedBy: undefined }
  );
  assert.doesNotMatch(JSON.stringify(evidence), /Confirm your order|cookie-wall|example\.test\/cart/u);
});

// `pendingNativeDialog` has no producer and cannot have one: an unanswered
// `alert` or `confirm` blocks the page's own script, so no snapshot leaves the
// page while one stands. The nearest producer field, `dialogs.armPending`, is
// a different fact -- an arming for `web.dom.dialog` the page-world override
// has not taken -- and feeding it here would tell a model a dialog is on
// screen when none is.
test("no snapshot can make the packet claim a native dialog is pending", () => {
  for (const evidence of [
    { dialogs: { open: [], modal: false, armPending: true } },
    { dialogs: { open: [{ selector: "#d", role: "dialog", modal: true, native: true, label: "Native" }], modal: true, armPending: true } },
    { dialogs: { open: [], modal: false, lastNative: { kind: "confirm", message: "Leave this page?", response: "dismiss", at: 1_700 } } }
  ]) {
    const packet = sanitizeWebLlmSnapshot(page(evidence));
    assert.equal("pendingNativeDialog" in packet, false, JSON.stringify(evidence));
  }
});

test("ignores a page item that arrives malformed rather than failing the whole packet", () => {
  const evidence = sanitizeWebLlmSnapshot(page({
    dialogs: "one dialog",
    overlays: 7,
    loading: null,
    navigation: [],
    elements: "a funnel"
  }, { frame: { isTop: "yes" }, elementTotal: -3 }));
  assert.deepEqual(
    { dialogs: evidence.dialogs, blockedBy: evidence.blockedBy, loading: evidence.loading, navigation: evidence.navigation, frame: evidence.frame },
    { dialogs: undefined, blockedBy: undefined, loading: undefined, navigation: undefined, frame: undefined }
  );
  assert.equal(evidence.elements.length, 1);
  assert.equal(sanitizeWebLlmSnapshot(page({}, { evidence: "not an object" })).dialogs, undefined);
});
