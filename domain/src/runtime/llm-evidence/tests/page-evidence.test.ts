// The page-level evidence items of Phase 1.4 steps 2 and 3. The producing
// side lives in `apps/extension/src/content/evidence/`; these rows pin the
// field names the packet reads and prove each item survives the hop compactly.

import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWebLlmSnapshot } from "..";

const page = (extra: Record<string, unknown>): Record<string, unknown> => ({
  url: "https://example.test/checkout",
  title: "Checkout",
  interactiveElements: [{ tagName: "button", selector: "#place-order", visibleText: "Place order" }],
  ...extra,
});

test("reports an open dialog, its modality, and a pending native dialog", () => {
  const evidence = sanitizeWebLlmSnapshot(page({
    dialogs: [
      { role: "dialog", name: "Confirm your order", modal: true, selector: "#confirm-dialog" },
      { role: "alertdialog", name: "Session expiring" },
      { name: "" },
      { role: "dialog", name: "Fourth dialog beyond the cap" },
    ],
    pendingNativeDialog: true,
  }));
  assert.deepEqual(evidence.dialogs, [
    { role: "dialog", name: "Confirm your order", modal: true, selector: "#confirm-dialog" },
    { role: "alertdialog", name: "Session expiring" },
  ]);
  assert.equal(evidence.pendingNativeDialog, true);
});

test("reports the top-most blocking overlay so a click that cannot land is explicable", () => {
  const evidence = sanitizeWebLlmSnapshot(page({
    blockingOverlay: { selector: "#cookie-wall", tagName: "DIV", role: "dialog", name: "We use cookies" },
  }));
  assert.deepEqual(evidence.blockedBy, { selector: "#cookie-wall", tag: "div", role: "dialog", name: "We use cookies" });
  assert.equal(sanitizeWebLlmSnapshot(page({ blockingOverlay: { name: "no selector" } })).blockedBy, undefined);
});

test("reports loading state only while the page is still settling", () => {
  assert.deepEqual(
    sanitizeWebLlmSnapshot(page({ loading: { readyState: "interactive", busy: true, spinner: true, pendingNavigation: true } })).loading,
    { readyState: "interactive", busy: true, spinner: true, pendingNavigation: true }
  );
  // A settled page with nothing pending says nothing, and costs nothing.
  assert.equal(sanitizeWebLlmSnapshot(page({ loading: { readyState: "complete", busy: false } })).loading, undefined);
  assert.equal(sanitizeWebLlmSnapshot(page({ loading: { readyState: "wat" } })).loading, undefined);
  assert.deepEqual(sanitizeWebLlmSnapshot(page({ loading: { readyState: "loading" } })).loading, { readyState: "loading" });
});

test("reports navigation state with the query string stripped from both ends", () => {
  const evidence = sanitizeWebLlmSnapshot(page({
    navigation: { pending: true, from: "https://example.test/cart?session=private", to: "https://example.test/checkout#step-2" },
  }));
  assert.deepEqual(evidence.navigation, { pending: true, from: "https://example.test/cart", to: "https://example.test/checkout" });
  assert.doesNotMatch(JSON.stringify(evidence), /private|step-2/u);
  assert.equal(sanitizeWebLlmSnapshot(page({ navigation: { to: "javascript:alert(1)" } })).navigation, undefined);
});

test("reports the pre-filter element total the capture declares, and that the capture itself truncated", () => {
  const declared = sanitizeWebLlmSnapshot(page({ elementTotal: 812, truncated: true }));
  assert.equal(declared.elementTotal, 812);
  assert.equal(declared.truncated, true);
  // Nothing was withheld, so restating the count the model can already see is not worth the bytes.
  assert.equal(sanitizeWebLlmSnapshot(page({})).elementTotal, undefined);
  assert.equal(sanitizeWebLlmSnapshot(page({})).truncated, false);
});

test("carries element-level recency and change flags as fields, not as ordering alone", () => {
  const evidence = sanitizeWebLlmSnapshot(page({
    interactiveElements: [
      { tagName: "input", selector: "#quantity", name: "Quantity", recentlyInteracted: true, changed: true },
      { tagName: "button", selector: "#place-order", visibleText: "Place order", recentlyInteracted: false, changed: false },
    ],
  }));
  assert.deepEqual(evidence.elements, [
    { target: "target.1", tag: "input", selector: "#quantity", name: "Quantity", recent: true, changed: true },
    { target: "target.2", tag: "button", selector: "#place-order", text: "Place order" },
  ]);
});

test("ignores a page item that arrives malformed rather than failing the whole packet", () => {
  const evidence = sanitizeWebLlmSnapshot(page({
    dialogs: "one dialog",
    blockingOverlay: 7,
    loading: null,
    navigation: [],
    elementTotal: -3,
    frame: { isTop: "yes" },
  }));
  assert.deepEqual(
    { dialogs: evidence.dialogs, blockedBy: evidence.blockedBy, loading: evidence.loading, navigation: evidence.navigation, elementTotal: evidence.elementTotal, frame: evidence.frame },
    { dialogs: undefined, blockedBy: undefined, loading: undefined, navigation: undefined, elementTotal: undefined, frame: undefined }
  );
  assert.equal(evidence.elements.length, 1);
});
