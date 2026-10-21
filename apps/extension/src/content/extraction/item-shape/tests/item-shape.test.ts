// T1 coverage of an item's shape: equal for items that differ only in their
// words, different when an element, a class or an attribute differs, and never
// holding a value.

import assert from "node:assert/strict";
import test from "node:test";
import { fakeShadowDom } from "../../tests/fake-shadow-dom";
import { itemShape } from "../item-shape";

const dom = fakeShadowDom();

function book(title: string, onLoan: boolean, shelf = "shelf"): Element {
  return dom.el("li", { class: "book", "data-id": title },
    dom.el("h3", { class: "title" }, title),
    dom.el("span", { class: shelf }, "Shelf 2"),
    ...(onLoan ? [dom.el("div", { class: "return", role: "button" }, "Return")] : []));
}

test("two items that differ only in their words and attribute values have one shape", () => {
  assert.equal(itemShape(book("First book", false)), itemShape(book("Second book", false)));
});

test("an item carrying one more control, or a different class, has another shape", () => {
  assert.notEqual(itemShape(book("A", false)), itemShape(book("A", true)));
  assert.notEqual(itemShape(book("A", false)), itemShape(book("A", false, "aisle")));
});

test("the shape holds no word and no attribute value of the item", () => {
  const shape = itemShape(book("Secret title", true));
  assert.doesNotMatch(shape, /Secret|Return|Shelf 2/u);
});
