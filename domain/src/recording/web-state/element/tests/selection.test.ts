// Which elements enter state, in what order, and what the selection says about
// what it left behind. The ranking cases came from the previous
// `recording/tests/web-state.test.ts`; the counting and duplicate cases are new.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationElementStateInput } from "../../types";
import { filterStateElements, shouldCaptureElementState } from "../selection";

const page: WebAutomationElementStateInput[] = [
  { tagName: "button", selector: "button.icon" },
  { tagName: "button", selector: "button.save", text: "Save", bounds: { x: 20, y: 30, width: 80, height: 32 } },
  { tagName: "a", selector: "a.home", href: "https://example.test/home", bounds: { x: 120, y: 30, width: 96, height: 24 } },
  { tagName: "input", selector: "input[name=search]", attributes: { name: "search" }, bounds: { x: 20, y: 80, width: 240, height: 36 } }
];

test("an element with no bounds is not captured, whatever else it has", () => {
  assert.equal(shouldCaptureElementState({ tagName: "button", selector: "button.icon", text: "Save" }), false);
  assert.equal(shouldCaptureElementState({ tagName: "div", selector: "div.empty", bounds: { x: 0, y: 0, width: 10, height: 10 } }), false);
});

test("capture-worthy elements come back most relevant first", () => {
  const selection = filterStateElements(page);
  assert.deepEqual(selection.elements.map((entry) => entry.element.selector), ["button.save", "a.home", "input[name=search]"]);
});

test("primary controls outrank content, and off-screen content still qualifies", () => {
  const selection = filterStateElements([
    { tagName: "section", selector: "section.hero", attributes: { id: "hero" }, bounds: { x: 0, y: 0, width: 800, height: 300 } },
    { tagName: "p", selector: "p.summary", text: "Account summary", bounds: { x: 20, y: 120, width: 220, height: 24 } },
    { tagName: "p", selector: "p.disclaimer", text: "Disclosures below the fold", documentBounds: { x: 20, y: 1200, width: 260, height: 24 }, isVisibleOnViewport: false },
    { tagName: "button", selector: "button.deposit", text: "Deposit", bounds: { x: 20, y: 40, width: 90, height: 36 } },
    { tagName: "div", selector: "div.empty", bounds: { x: 20, y: 180, width: 100, height: 20 } }
  ]);
  const selectors = selection.elements.map((entry) => entry.element.selector);
  assert.equal(selectors[0], "button.deposit");
  assert.equal(selectors.includes("p.summary"), true);
  assert.equal(selectors.includes("p.disclaimer"), true);
  assert.equal(selectors.includes("div.empty"), false);
});

test("a page of noise does not push the elements that carry meaning out", () => {
  const noise = Array.from({ length: 1_600 }, (_, index) => ({
    tagName: "div",
    selector: `div.wrapper-${index}`,
    text: `Wrapper ${index}`,
    bounds: { x: 0, y: index * 20, width: 800, height: 18 }
  }));
  const selection = filterStateElements([
    ...noise,
    { tagName: "a", selector: "a.billing", href: "https://example.test/billing", text: "Billing", bounds: { x: 20, y: 20, width: 80, height: 24 } },
    { tagName: "p", selector: "p.balance", text: "Available balance", bounds: { x: 20, y: 60, width: 160, height: 24 } },
    { tagName: "h2", selector: "h2.accounts", text: "Accounts", bounds: { x: 20, y: 100, width: 140, height: 32 } }
  ]);
  const selectors = new Set(selection.elements.map((entry) => entry.element.selector));
  assert.equal(selectors.has("a.billing"), true);
  assert.equal(selectors.has("p.balance"), true);
  assert.equal(selectors.has("h2.accounts"), true);
});

test("the selection reports the page's total, not just what it kept", () => {
  const selection = filterStateElements(page);
  assert.equal(selection.total, 4, "every element the page offered");
  assert.equal(selection.eligible, 3);
  assert.equal(selection.captured, 3);
  assert.equal(selection.elements.length, selection.captured);
  assert.equal(selection.truncated, false, "the one dropped element carried no evidence; nothing was cut for size");
});

test("truncated is set only when the cap dropped elements worth capturing", () => {
  const selection = filterStateElements(page, 2);
  assert.equal(selection.total, 4);
  assert.equal(selection.eligible, 3);
  assert.equal(selection.captured, 2);
  assert.equal(selection.truncated, true);
  assert.deepEqual(selection.elements.map((entry) => entry.element.selector), ["button.save", "a.home"]);
});

test("controls sharing a data-testid are all captured, each under its own key", () => {
  const selection = filterStateElements([
    { tagName: "button", selector: "tr:nth-child(1) button", text: "Delete", attributes: { "data-testid": "row-action" }, bounds: { x: 10, y: 10, width: 60, height: 24 } },
    { tagName: "button", selector: "tr:nth-child(2) button", text: "Delete", attributes: { "data-testid": "row-action" }, bounds: { x: 10, y: 40, width: 60, height: 24 } },
    { tagName: "button", selector: "tr:nth-child(3) button", text: "Delete", attributes: { "data-testid": "row-action" }, bounds: { x: 10, y: 70, width: 60, height: 24 } }
  ]);
  assert.equal(selection.captured, 3, "collapsing these by state key lost every row but the first");
  assert.deepEqual(selection.elements.map((entry) => entry.stateId).sort(), ["row.action", "row.action.2", "row.action.3"]);
  assert.equal(selection.truncated, false);
});

test("the positional suffix follows document order, not relevance order", () => {
  const selection = filterStateElements([
    { tagName: "a", selector: "a.first", href: "https://example.test/1", attributes: { "data-testid": "row-action" }, bounds: { x: 10, y: 10, width: 60, height: 24 } },
    { tagName: "a", selector: "a.second", href: "https://example.test/2", text: "Open the account", attributes: { "data-testid": "row-action" }, bounds: { x: 10, y: 40, width: 60, height: 24 } }
  ]);
  assert.deepEqual(selection.elements.map((entry) => entry.element.selector), ["a.second", "a.first"], "the one with text ranks higher");
  const keyBySelector = new Map(selection.elements.map((entry) => [entry.element.selector, entry.stateId]));
  assert.equal(keyBySelector.get("a.first"), "row.action", "first in the document keeps the bare key");
  assert.equal(keyBySelector.get("a.second"), "row.action.2", "a key that moved with the score would rename it on every snapshot");
});
