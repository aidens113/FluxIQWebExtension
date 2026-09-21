// No two elements of a packet read alike.
//
// The realistic sites repeat labels on purpose, and until 2026-09-21 the packet
// handed the model two handles for one description wherever they did: on the
// everything store's front page three of the first ten elements were
// `{ tag: "div" }` and nothing else, and the store's cards each carry an
// "Add to cart". The rows below hold the three cues that tell such elements
// apart -- the dialog, the row's words, which from the top -- and the property
// the packet now keeps: after them, no description is shared.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import type { WebLlmEvidenceElement } from "../elements";
import { sanitizeWebLlmSnapshotWithBindings, type WebLlmPageEvidence } from "../sanitize";

const PAGE_URL = "https://store.test/s";

function packet(interactiveElements: JsonObject[], evidence?: JsonObject, maxEvidenceBytes?: number): WebLlmPageEvidence {
  const snapshot: JsonObject = { url: PAGE_URL, title: "Results", interactiveElements };
  if (evidence !== undefined) snapshot.evidence = evidence;
  return sanitizeWebLlmSnapshotWithBindings(snapshot, maxEvidenceBytes === undefined ? {} : { maxEvidenceBytes }).evidence;
}

/**
 * What the model reads an element as, written out field by field: everything
 * but the handle being chosen and the state that changes as the Flow runs.
 */
function description(element: WebLlmEvidenceElement): string {
  return JSON.stringify([
    element.tag, element.frameId, element.role, element.name, element.text, element.inputType, element.controlType,
    element.href, element.options, element.revealKind, element.form, element.landmark, element.heading, element.item,
    element.cell, element.dialog, element.within, element.alike
  ]);
}

function assertNoTwoAlike(elements: readonly WebLlmEvidenceElement[]): void {
  const seen = new Map<string, string>();
  for (const element of elements) {
    const key = description(element);
    assert.equal(seen.get(key), undefined, `${element.target} reads exactly like ${seen.get(key)}: ${key}`);
    seen.set(key, element.target);
  }
}

const wrapper = (selector: string, top: number): JsonObject => ({ tagName: "div", selector, documentBounds: { x: 0, y: top, width: 100, height: 20 } });

test("wrappers the page gives nothing to tell apart are counted top to bottom", () => {
  // The capture lists them out of page order; the count follows the page.
  const evidence = packet([wrapper("#c", 300), wrapper("#a", 100), wrapper("#b", 200)]);
  assert.deepEqual(evidence.elements, [
    { target: "target.1", tag: "div", alike: { index: 3, total: 3 } },
    { target: "target.2", tag: "div", alike: { index: 1, total: 3 } },
    { target: "target.3", tag: "div", alike: { index: 2, total: 3 } }
  ]);
});

test("look-alikes the page did not measure keep the packet's order, after the ones it did", () => {
  const evidence = packet([{ tagName: "div", selector: "#x" }, wrapper("#y", 50), { tagName: "div", selector: "#z" }]);
  assert.deepEqual(evidence.elements.map((element) => element.alike), [{ index: 2, total: 3 }, { index: 1, total: 3 }, { index: 3, total: 3 }]);
});

function addToCart(selector: string, card: string, top?: number): JsonObject {
  const button: JsonObject = { tagName: "button", selector, visibleText: "Add to cart", context: { landmark: "main", record: { text: card } } };
  if (top !== undefined) button.documentBounds = { x: 0, y: top, width: 80, height: 20 };
  return button;
}

test("the same control in two cards is told apart by each card's own words", () => {
  const evidence = packet([
    addToCart("#add-1", "Soundcrest Air Pro 2 Wireless Earbuds 4.3 out of 5 stars $49.99"),
    addToCart("#add-2", "Brightaisle Buds Lite 4.1 out of 5 stars $19.99"),
    // In a card too, but alike nothing: it is given nothing.
    { tagName: "a", selector: "#title-1", visibleText: "Soundcrest Air Pro 2 Wireless Earbuds", context: { record: { text: "Soundcrest Air Pro 2 Wireless Earbuds 4.3 out of 5 stars $49.99" } } }
  ]);
  assert.deepEqual(evidence.elements, [
    { target: "target.1", tag: "button", text: "Add to cart", landmark: "main", within: "Soundcrest Air Pro 2 Wireless Earbuds 4.3 out of 5 stars $49.99" },
    { target: "target.2", tag: "button", text: "Add to cart", landmark: "main", within: "Brightaisle Buds Lite 4.1 out of 5 stars $19.99" },
    { target: "target.3", tag: "a", text: "Soundcrest Air Pro 2 Wireless Earbuds" }
  ]);
});

test("a card's words are cut to the placement bound, like a heading", () => {
  const long = `Soundcrest Air Pro 2 ${"with a very long marketing description ".repeat(6)}`;
  const evidence = packet([addToCart("#add-1", long), addToCart("#add-2", "Brightaisle Buds Lite")]);
  assert.equal(evidence.elements[0]?.within?.length, 80);
  assert.ok(long.replace(/\s+/gu, " ").startsWith(evidence.elements[0]!.within!));
});

test("cards with the same words are still told apart, by which comes first", () => {
  const evidence = packet([
    addToCart("#add-1", "Refurbished earbuds $9.99", 400),
    addToCart("#add-2", "Refurbished earbuds $9.99", 200)
  ]);
  // The words are the same, so they tell nobody apart and are not spent.
  assert.deepEqual(evidence.elements.map((element) => [element.within, element.alike]), [
    [undefined, { index: 2, total: 2 }],
    [undefined, { index: 1, total: 2 }]
  ]);
});

const promotion = { selector: "#promo", role: "dialog", modal: true, native: false, label: "Never miss a deal", bounds: { x: 100, y: 100, width: 400, height: 300 } };
const close = (selector: string, x: number, y: number): JsonObject => ({ tagName: "button", selector, accessibleName: "Close", bounds: { x, y, width: 20, height: 20 } });

test("a dialog's control and the page's control of the same name are told apart by the dialog", () => {
  const evidence = packet([close("#banner-close", 900, 10), close("#promo-close", 460, 110)], { dialogs: { open: [promotion], modal: true } });
  // The dialog's own control comes first (`front-layer.ts`) and says whose it is.
  assert.deepEqual(evidence.elements.map((element) => [element.target, element.name, element.dialog, element.alike]), [
    ["target.1", "Close", "Never miss a deal", undefined],
    ["target.2", "Close", undefined, undefined]
  ]);
});

test("a dialog the page gave no name names nothing, and the count still tells its controls apart", () => {
  const unnamed = { selector: "#promo", role: "dialog", modal: true, native: false, bounds: promotion.bounds };
  const evidence = packet([close("#banner-close", 900, 10), close("#promo-close", 460, 110)], { dialogs: { open: [unnamed], modal: true } });
  assert.deepEqual(evidence.elements.map((element) => [element.dialog, element.alike?.total]), [[undefined, 2], [undefined, 2]]);
});

test("elements the packet already tells apart are given nothing, so a page without look-alikes costs nothing", () => {
  const evidence = packet([
    { tagName: "button", selector: "#go-search", visibleText: "Go", context: { landmark: "search", record: { text: "one" } } },
    { tagName: "input", selector: "#go-price", inputType: "submit", attributes: { type: "submit" }, visibleText: "Go", context: { landmark: "complementary", record: { text: "two" } } },
    { tagName: "button", selector: "#add-1", visibleText: "Add to cart", context: { heading: "Soundcrest Air Pro 2" } },
    { tagName: "button", selector: "#add-2", visibleText: "Add to cart", context: { heading: "Brightaisle Buds Lite" } }
  ]);
  for (const element of evidence.elements) assert.deepEqual([element.dialog, element.within, element.alike], [undefined, undefined, undefined], element.target);
});

test("the count describes the packet that is sent: a look-alike the budget cut is not counted", () => {
  const elements = [wrapper("#a", 100), wrapper("#b", 200), { tagName: "p", selector: "#note", visibleText: "x".repeat(200) }, wrapper("#c", 300)];
  const whole = packet(elements);
  assert.deepEqual(whole.elements.filter((element) => element.tag === "div").map((element) => element.alike?.total), [3, 3, 3]);
  // Tighten the budget one byte at a time until the last wrapper is cut.
  let budget = JSON.stringify(whole).length + 64;
  let cut = packet(elements, undefined, budget);
  while (cut.elements.length === 4) cut = packet(elements, undefined, --budget);
  assert.equal(cut.elements.length, 3);
  assert.equal(cut.budgetTruncated, true);
  assert.deepEqual(cut.elements.filter((element) => element.tag === "div").map((element) => element.alike), [{ index: 1, total: 2 }, { index: 2, total: 2 }]);
  assertNoTwoAlike(cut.elements);
});

test("a store results page read as the model reads it has no two elements alike", () => {
  const cards = ["Soundcrest Air Pro 2 $49.99", "Brightaisle Buds Lite $19.99", "Soundcrest Air Pro 2 $49.99"];
  const interactiveElements: JsonObject[] = [
    { tagName: "button", selector: "#go-search", accessibleName: "Go", context: { landmark: "search" } },
    { tagName: "input", selector: "#go-price", accessibleName: "Go", context: { landmark: "complementary" } },
    ...cards.flatMap((card, index): JsonObject[] => [
      { tagName: "a", selector: `#see-${index}`, visibleText: "See options", href: "/s", context: { landmark: "main", record: { text: card } }, documentBounds: { x: 0, y: 100 * index, width: 80, height: 20 } },
      { tagName: "div", selector: `#spacer-${index}`, documentBounds: { x: 0, y: 100 * index + 50, width: 80, height: 5 } },
      { tagName: "span", selector: `#ad-${index}`, role: "button", accessibleName: "Leave ad feedback", context: { landmark: "main", record: { text: card } } }
    ]),
    close("#close-a", 10, 10),
    close("#close-b", 10, 10)
  ];
  const evidence = packet(interactiveElements, { dialogs: { open: [{ ...promotion, bounds: { x: 0, y: 0, width: 50, height: 50 } }], modal: false } });
  assertNoTwoAlike(evidence.elements);
});
