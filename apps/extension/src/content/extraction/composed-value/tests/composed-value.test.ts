// T1 coverage of `composed-value.ts`: which elements state a value their
// children draw in pieces. The cross-border marketplace draws a price as four
// sibling spans (`t194-w26-spain-hubs-fixture.md`, G1).

import assert from "node:assert/strict";
import test from "node:test";
import { composesValue, isComposedPiece } from "../composed-value";
import { fakeShadowDom } from "../../tests/fake-shadow-dom";

const dom = fakeShadowDom();

function price(...pieces: string[]): Element {
  return dom.el("div", { class: "price" }, ...pieces.map((piece) => dom.el("span", {}, piece)));
}

test("a price drawn as a whole number, decimals and a currency in sibling spans is one value", () => {
  assert.equal(composesValue(price("", "16", ",49", " €")), true);
  assert.equal(composesValue(price("$", "1,299", ".00")), true);
});

test("a row whose pieces are a whole amount and a discount is not one value", () => {
  assert.equal(composesValue(price("29,99 €", "-45%")), false);
});

test("a row one of whose pieces already states the whole value's shape is not composed of it", () => {
  // "16" is a number on its own, so "16" + ",49" adds no shape to it.
  assert.equal(composesValue(price("16", ",49")), false);
  assert.equal(composesValue(price("16,49 €", "")), false);
});

test("an element with one child, or with a child that has children, is not composed of pieces", () => {
  assert.equal(composesValue(dom.el("div", {}, dom.el("span", {}, "16,49 €"))), false);
  assert.equal(composesValue(dom.el("div", {}, dom.el("span", {}, dom.el("b", {}, "16")), dom.el("span", {}, ",49 €"))), false);
});

test("a piece is the value's inside the item, but a piece of the item itself is not", () => {
  const whole = price("", "16", ",49", " €");
  const card = dom.el("div", { class: "card" }, whole);
  assert.equal(isComposedPiece(card, whole.children[1]!), true);
  assert.equal(isComposedPiece(card, whole), false);
  assert.equal(isComposedPiece(whole, whole.children[1]!), false);
});
