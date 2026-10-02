// The selector forms a detection writes, read over a capture's tree: what each
// names, and that a form the walk does not read is refused rather than guessed.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { sanitizeWebLlmSnapshotWithBindings } from "../../../sanitize";
import { webLlmSelectedWithin } from "../chain";
import { webLlmCompoundMatcher } from "../compound";
import { webLlmPageTree } from "../tree";

const ITEM = "ul > li:nth-of-type(1)";

/** One list item: a heading link, two plain spans, a test-id price and a classless note. */
function tree() {
  const elements: JsonObject[] = [
    { tagName: "ul", selector: "ul", attributes: {} },
    { tagName: "li", selector: ITEM, attributes: { class: "card" }, parent: 0 },
    { tagName: "a", selector: `${ITEM} > a`, attributes: { class: "title link", href: "/p/1" }, visibleText: "One", parent: 1 },
    { tagName: "span", selector: `${ITEM} > span:nth-of-type(1)`, attributes: { class: "meta" }, visibleText: "A", parent: 1 },
    { tagName: "span", selector: `${ITEM} > span:nth-of-type(2)`, attributes: { class: "meta" }, visibleText: "B", parent: 1 },
    { tagName: "b", selector: '[data-testid="price"]', attributes: { "data-testid": "price \"x\"" }, visibleText: "$1", parent: 1 },
    { tagName: "i", selector: `${ITEM} > i`, visibleText: "note", parent: 1 },
    { tagName: "li", selector: "ul > li:nth-of-type(2)", attributes: { class: "card" }, parent: 0 }
  ];
  const binding = sanitizeWebLlmSnapshotWithBindings({ url: "https://shop.test/", interactiveElements: elements });
  const pageTree = webLlmPageTree(binding);
  const item = pageTree.addressed(ITEM);
  assert.ok(item, "the item is addressed by its selector");
  return { pageTree, item };
}

function named(selector: string): string[] | undefined {
  const { pageTree, item } = tree();
  return webLlmSelectedWithin(pageTree, item, selector)?.map((node) => node.selector);
}

test("each form the detection writes names the element it was written for", () => {
  assert.deepEqual(named(":scope > a.link.title"), [`${ITEM} > a`]);
  assert.deepEqual(named(":scope > span:nth-of-type(2)"), [`${ITEM} > span:nth-of-type(2)`]);
  assert.deepEqual(named(":scope span.meta"), [`${ITEM} > span:nth-of-type(1)`, `${ITEM} > span:nth-of-type(2)`]);
  assert.deepEqual(named('[data-testid="price \\"x\\""]'), ['[data-testid="price"]']);
  assert.deepEqual(named('[data-testid^="price"]'), ['[data-testid="price"]']);
  assert.deepEqual(named(":scope > i:not([class])"), [`${ITEM} > i`]);
  assert.deepEqual(named(":scope > span:not([class])"), []);
});

test("an element addressed by its own anchor says no position, so a positional step does not match it", () => {
  assert.deepEqual(named(":scope > b:nth-of-type(1)"), []);
  assert.deepEqual(named(":scope > b"), ['[data-testid="price"]']);
});

test("a form the walk does not read is refused, not guessed", () => {
  for (const selector of [":scope > a#main", ":scope > a:first-child", "li a", ":scope > > a", ":scope >", '[data-testid="open', ""]) {
    assert.equal(named(selector), undefined, selector);
  }
  assert.equal(webLlmCompoundMatcher(""), undefined);
  // An attribute the page named after an object's own property is read as the page's.
  const matcher = webLlmCompoundMatcher("[toString]");
  assert.ok(matcher);
  assert.equal(matcher({ tag: "a", attributes: {}, typeIndex: undefined }), false);
});
