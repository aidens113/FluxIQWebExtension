import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWebLlmSnapshot } from "../sanitize";
import { webLlmStateDigest } from "../state-digest";

// The digest contract, asserted in both directions, because both halves of it
// are how a reduction goes wrong.
//
// Too coarse -- equal digests either side of a step that changed something the
// automation depends on -- and the reducer drops that step as `changed_nothing`
// and hands back a sequence missing the step that did the work. Too fine --
// digests that differ when nothing an automation depends on changed -- and the
// undo the reducer recognises by the state coming back never comes back, so
// nothing reduces and the precondition names a state that will not recur.

/** A page with one disclosure and the control it hides, closed. */
function listingSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    url: "https://example.test/listing",
    title: "Listing",
    interactiveElements: [
      { tagName: "button", selector: "#more", accessibleName: "More options", attributes: {}, expanded: false },
      { tagName: "a", selector: "#first", visibleText: "First item", href: "/items/1" },
    ],
    ...overrides,
  };
}

test("a page nobody touched digests to the same string twice", () => {
  const first = webLlmStateDigest(sanitizeWebLlmSnapshot(listingSnapshot()));
  const second = webLlmStateDigest(sanitizeWebLlmSnapshot(listingSnapshot()));

  assert.equal(first, second);
  // Opaque and short: nothing of the page can be read back out of it.
  assert.match(first, /^web-state\.v1:\d+:[0-9a-f]+$/u);
  assert.doesNotMatch(first, /example\.test|More options|First item/u);
});

test("a control appearing changes the digest", () => {
  const before = webLlmStateDigest(sanitizeWebLlmSnapshot(listingSnapshot()));
  const after = webLlmStateDigest(sanitizeWebLlmSnapshot(listingSnapshot({
    interactiveElements: [
      { tagName: "button", selector: "#more", accessibleName: "More options", attributes: {}, expanded: true },
      { tagName: "a", selector: "#first", visibleText: "First item", href: "/items/1" },
      { tagName: "button", selector: "#export", accessibleName: "Export", attributes: {} },
    ],
  })));

  assert.notEqual(before, after);
});

test("moving to another page changes the digest", () => {
  const before = webLlmStateDigest(sanitizeWebLlmSnapshot(listingSnapshot()));
  const after = webLlmStateDigest(sanitizeWebLlmSnapshot(listingSnapshot({ url: "https://example.test/items/1" })));

  assert.notEqual(before, after);
});

test("a modal standing in front of the page changes the digest", () => {
  const before = webLlmStateDigest(sanitizeWebLlmSnapshot(listingSnapshot()));
  const after = webLlmStateDigest(sanitizeWebLlmSnapshot(listingSnapshot({
    evidence: { dialogs: { open: [{ role: "dialog", label: "Are you sure?", modal: true }] } },
  })));

  assert.notEqual(before, after);
});

// The undo case, and the reason `navigation`, `loading` and `selectedText` are
// left out. A page reached by going back is the same page; if any of these
// reached the digest, the state would never return to what it was, the reducer
// would keep the wrong step and the step that reversed it, and nothing at all
// would be reduced.
test("a page reached by going back digests the same as the page first arrived at", () => {
  const arrived = webLlmStateDigest(sanitizeWebLlmSnapshot(listingSnapshot({
    evidence: { navigation: { type: "navigate" }, loading: { documentState: "complete" } },
  })));
  const returned = webLlmStateDigest(sanitizeWebLlmSnapshot(listingSnapshot({
    selectedText: "First item",
    evidence: {
      navigation: { type: "back_forward", redirects: 1, referrer: "https://example.test/items/1" },
      loading: { documentState: "interactive", busy: true, indicators: [{ kind: "spinner" }] },
    },
  })));

  assert.equal(arrived, returned);
});

// The same defect one level up: the packet ranks recently touched elements
// first, so a click reorders the list. Sorting the element lines before hashing
// is what keeps the exploration's own footprints out of the state.
test("the order the capture ranked the controls in does not change the digest", () => {
  const ranked = webLlmStateDigest(sanitizeWebLlmSnapshot(listingSnapshot()));
  const reranked = webLlmStateDigest(sanitizeWebLlmSnapshot(listingSnapshot({
    interactiveElements: [
      { tagName: "a", selector: "#first", visibleText: "First item", href: "/items/1", recentlyInteracted: true },
      { tagName: "button", selector: "#more", accessibleName: "More options", attributes: {}, expanded: false },
    ],
  })));

  assert.equal(ranked, reranked);
});

// A digest computed from the sanitized packet cannot carry what the sanitizer
// refused: a password field is not described, so it cannot move the state
// either. The hash is strictly less than the packet Core is already shown.
test("a control the sanitizer refuses is not in the state", () => {
  const without = webLlmStateDigest(sanitizeWebLlmSnapshot(listingSnapshot()));
  const withSecret = webLlmStateDigest(sanitizeWebLlmSnapshot(listingSnapshot({
    interactiveElements: [
      { tagName: "button", selector: "#more", accessibleName: "More options", attributes: {}, expanded: false },
      { tagName: "a", selector: "#first", visibleText: "First item", href: "/items/1" },
      { tagName: "input", selector: "#password", name: "Password", inputType: "password", value: "private" },
    ],
  })));

  assert.equal(without, withSecret);
});
