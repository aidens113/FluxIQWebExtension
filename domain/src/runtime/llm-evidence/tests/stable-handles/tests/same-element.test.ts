// The same element keeps its handle for the whole run (t1036, D2,
// `../../../stable-handles.ts`): within one document by the element itself, and
// under another query of its page by an unambiguous match -- never a guess, and
// a handle is never given to another element.
//
// Why: in the 2026-11-24 bigbox runs 38 of 136 page handles the model used
// named a handle no longer on the page; in `run-mwuuo3zk` the model named
// `t1446` twenty times after a filter changed the address and the page numbered
// the same cards afresh (t1035 audit, "Handles").

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { sanitizeWebLlmSnapshotWithBindings, type WebLlmSnapshotBinding } from "../../../sanitize";
import { createWebLlmStableTargetHandles } from "../../../stable-handles";

const SCOPE = { projectId: "project", flowId: "flow" };
const RESULTS = "https://shop.test/search?q=towel";
const FILTERED = "https://shop.test/search?q=towel&pickup=today";

/** A product card's title link, at position `at` in the result list, in the record `sku`. */
function card(sku: string, title: string, at: number, node?: number): JsonObject {
  const raw: JsonObject = { tagName: "a", selector: `main > ul > li:nth-of-type(${at}) > a`, visibleText: title, context: { record: { key: sku, keyAttribute: "data-sku" } } };
  if (node !== undefined) raw.nodeToken = node;
  return raw;
}

/** A capture of `elements` at `url`, in the document whose `timeOrigin` is `document`. */
function capture(url: string, elements: JsonObject[], document: number): WebLlmSnapshotBinding {
  return sanitizeWebLlmSnapshotWithBindings({ url, title: "Results", interactiveElements: elements, evidence: { navigation: { timeOrigin: document } } });
}

function handleOf(binding: WebLlmSnapshotBinding, words: string): string {
  const found = binding.evidence.elements.filter((element) => element.text === words);
  assert.equal(found.length, 1, `one element reads "${words}"`);
  return found[0]!.target;
}

test("an element inserted above leaves every element below with its handle, by its node in the same document", () => {
  const handles = createWebLlmStableTargetHandles();
  const before = handles.restamp(SCOPE, capture(RESULTS, [card("a", "Soft towel", 1, 11), card("b", "Bath towel", 2, 12)], 1));
  const banner: JsonObject = { tagName: "a", selector: "main > ul > li:nth-of-type(1) > a", visibleText: "Sponsored towel", context: { record: { key: "ad", keyAttribute: "data-sku" } }, nodeToken: 30 };
  const after = handles.restamp(SCOPE, capture(RESULTS, [banner, card("a", "Soft towel", 2, 11), card("b", "Bath towel", 3, 12)], 1));
  assert.equal(handleOf(after, "Soft towel"), handleOf(before, "Soft towel"));
  assert.equal(handleOf(after, "Bath towel"), handleOf(before, "Bath towel"));
  assert.ok(![handleOf(before, "Soft towel"), handleOf(before, "Bath towel")].includes(handleOf(after, "Sponsored towel")), "the inserted element is given a new handle");
});

test("within one document the element keeps its handle when its words change, by its node", () => {
  const handles = createWebLlmStableTargetHandles();
  const add = (words: string, at: number): JsonObject => ({ tagName: "button", selector: `main > div:nth-of-type(${at}) > button`, visibleText: words, context: { record: { key: "a", keyAttribute: "data-sku" } }, nodeToken: 5 });
  const other = (at: number): JsonObject => ({ tagName: "button", selector: `main > div:nth-of-type(${at}) > button`, visibleText: "Compare", context: { record: { key: "a", keyAttribute: "data-sku" } }, nodeToken: 6 });
  const before = handles.restamp(SCOPE, capture(RESULTS, [add("Add to cart", 1), other(2)], 1));
  const after = handles.restamp(SCOPE, capture(RESULTS, [{ tagName: "p", selector: "main > p", visibleText: "Added", nodeToken: 9 }, add("Added to cart", 2), other(3)], 1));
  assert.equal(handleOf(after, "Added to cart"), handleOf(before, "Add to cart"));
  assert.equal(handleOf(after, "Compare"), handleOf(before, "Compare"));
});

test("a node a list recycles for another item is not the item it showed: its record changed, so it gets a new handle", () => {
  const handles = createWebLlmStableTargetHandles();
  const before = handles.restamp(SCOPE, capture(RESULTS, [card("a", "Soft towel", 1, 11)], 1));
  const after = handles.restamp(SCOPE, capture(RESULTS, [card("z", "Beach towel", 1, 11)], 1));
  assert.notEqual(handleOf(after, "Beach towel"), handleOf(before, "Soft towel"));
});

test("the same card under another query keeps its handle, wherever the new list puts it", () => {
  const handles = createWebLlmStableTargetHandles();
  const before = handles.restamp(SCOPE, capture(RESULTS, [card("a", "Soft towel", 1), card("b", "Bath towel", 2), card("c", "Hand towel", 3)], 1));
  // A filter loads a new document whose list leaves one card out and reorders the rest.
  const after = handles.restamp(SCOPE, capture(FILTERED, [card("c", "Hand towel", 1), card("a", "Soft towel", 2)], 2));
  assert.equal(handleOf(after, "Hand towel"), handleOf(before, "Hand towel"));
  assert.equal(handleOf(after, "Soft towel"), handleOf(before, "Soft towel"));
  // And back: the first page's cards are found again at their own addresses.
  const back = handles.restamp(SCOPE, capture(RESULTS, [card("a", "Soft towel", 1), card("b", "Bath towel", 2), card("c", "Hand towel", 3)], 3));
  for (const words of ["Soft towel", "Bath towel", "Hand towel"]) assert.equal(handleOf(back, words), handleOf(before, words), words);
});

test("two look-alikes under the other query are ambiguous: each gets a new handle, never a guess", () => {
  const handles = createWebLlmStableTargetHandles();
  const pickup = (at: number): JsonObject => ({ tagName: "button", selector: `main > ul > li:nth-of-type(${at}) > button`, visibleText: "Pick up today" });
  const before = handles.restamp(SCOPE, capture(RESULTS, [pickup(1)], 1));
  const first = before.evidence.elements[0]!.target;
  const after = handles.restamp(SCOPE, capture(FILTERED, [pickup(1), pickup(2)], 2));
  const shown = after.evidence.elements.map((element) => element.target);
  assert.equal(shown.includes(first), false, "neither look-alike takes the one handle");
  assert.equal(new Set(shown).size, 2);
});

test("two candidate handles for one element under the other query are ambiguous too", () => {
  const handles = createWebLlmStableTargetHandles();
  const pickup = (at: number): JsonObject => ({ tagName: "button", selector: `main > ul > li:nth-of-type(${at}) > button`, visibleText: "Pick up today" });
  const before = handles.restamp(SCOPE, capture(RESULTS, [pickup(1), pickup(2)], 1));
  const after = handles.restamp(SCOPE, capture(FILTERED, [pickup(1)], 2));
  const spent = before.evidence.elements.map((element) => element.target);
  assert.equal(spent.includes(after.evidence.elements[0]!.target), false);
});

test("words alone never carry a handle across a query: another kind of element with the same words is another element", () => {
  const handles = createWebLlmStableTargetHandles();
  const before = handles.restamp(SCOPE, capture(RESULTS, [card("a", "Soft towel", 1)], 1));
  const heading: JsonObject = { tagName: "h2", selector: "main > h2", visibleText: "Soft towel" };
  const after = handles.restamp(SCOPE, capture(FILTERED, [heading], 2));
  assert.notEqual(handleOf(after, "Soft towel"), handleOf(before, "Soft towel"));
});

test("a control on another path is another page's control, with its own handle", () => {
  const handles = createWebLlmStableTargetHandles();
  const searchBox: JsonObject = { tagName: "input", selector: "header input", accessibleName: "Search" };
  const front = handles.restamp(SCOPE, capture("https://shop.test/", [searchBox], 1));
  const results = handles.restamp(SCOPE, capture(RESULTS, [searchBox], 2));
  assert.notEqual(results.evidence.elements[0]!.target, front.evidence.elements[0]!.target);
});

test("a handle is never given to another element, across every capture of the run", () => {
  const handles = createWebLlmStableTargetHandles();
  const named = new Map<string, string>();
  const seen = (binding: WebLlmSnapshotBinding): void => {
    for (const element of binding.evidence.elements) {
      const who = `${element.tag}:${element.text}`;
      const earlier = named.get(element.target);
      assert.ok(earlier === undefined || earlier === who, `${element.target} named ${earlier} and then ${who}`);
      named.set(element.target, who);
    }
  };
  seen(handles.restamp(SCOPE, capture(RESULTS, [card("a", "Soft towel", 1), card("b", "Bath towel", 2)], 1)));
  seen(handles.restamp(SCOPE, capture(FILTERED, [card("b", "Bath towel", 1), card("d", "Tea towel", 2)], 2)));
  seen(handles.restamp(SCOPE, capture(RESULTS, [card("d", "Tea towel", 1), card("a", "Soft towel", 2)], 3)));
  seen(handles.restamp(SCOPE, capture(`${RESULTS}&page=2`, [card("e", "Bath sheet", 1), card("a", "Soft towel", 2)], 4)));
});

test("a hidden look-alike in a capture that lists hidden elements neither takes the handle nor makes the visible card ambiguous", () => {
  const handles = createWebLlmStableTargetHandles();
  const before = handles.restamp(SCOPE, capture(RESULTS, [card("a", "Soft towel", 1)], 1));
  const hiddenCopy = card("a", "Soft towel", 9);
  hiddenCopy.hidden = true;
  const after = handles.restamp(SCOPE, capture(FILTERED, [card("a", "Soft towel", 2), hiddenCopy], 2));
  const visible = after.evidence.elements.find((element) => element.hidden !== true)!;
  const hidden = after.evidence.elements.find((element) => element.hidden === true)!;
  assert.equal(visible.target, handleOf(before, "Soft towel"));
  assert.notEqual(hidden.target, visible.target);
});
