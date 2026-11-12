// Whether an item is shown (t903): a person opens a closed menu before reading it, and so does
// FluxIQ, with a hover or a click; the list reader does not read an item this calls hidden
// (`../../tests/list-reader.test.ts`). The browser's own `checkVisibility` says which; an element
// offering no measure is taken as shown.

import assert from "node:assert/strict";
import test from "node:test";
import { isRenderedItem } from "..";
import { fakeShadowDom } from "../../tests/fake-shadow-dom";

const dom = fakeShadowDom();

function line(shown: boolean | undefined): Element {
  const element = dom.el("p", { "data-testid": "saved-lists" }, "Saved lists: Winter coats; Desk lamps");
  if (shown !== undefined) Object.assign(element, { checkVisibility: () => shown });
  return element;
}

test("only the browser's word makes an item hidden", () => {
  assert.equal(isRenderedItem(line(false)), false);
  assert.equal(isRenderedItem(line(true)), true);
  assert.equal(isRenderedItem(line(undefined)), true);
});

// A wrapper drawn `display: contents` has no box, and a `visibility: hidden` row may show its cells:
// `checkVisibility` is false on the item in both, yet a person sees the row. The item is shown when
// anything inside it is.
test("an item with no box of its own is shown when something inside it is", () => {
  const cell = dom.el("span", {}, "Shown");
  Object.assign(cell, { checkVisibility: () => true });
  const wrapper = dom.el("a", { href: "/p/1" }, cell);
  Object.assign(wrapper, { checkVisibility: () => false });
  assert.equal(isRenderedItem(wrapper), true);
  const closed = dom.el("div", {}, dom.el("span", {}, "Hidden"));
  Object.assign(closed, { checkVisibility: () => false });
  Object.assign(closed.querySelector("span")!, { checkVisibility: () => false });
  assert.equal(isRenderedItem(closed), false);
});

// A select's option has no box (`checkVisibility` is false): its select draws it. Options of a shown
// select are shown, and read; options of a hidden one are not.
test("an option is shown when its select is", () => {
  const option = dom.el("option", { value: "m" }, "Medium");
  Object.assign(option, { checkVisibility: () => false });
  const select = dom.el("select", { name: "size" }, option);
  Object.assign(select, { checkVisibility: () => true });
  // The shared fake answers no `closest`; the browser's names the select.
  Object.assign(option, { closest: (selector: string) => (selector === "select" ? select : null) });
  assert.equal(isRenderedItem(option), true);
  Object.assign(select, { checkVisibility: () => false });
  assert.equal(isRenderedItem(option), false);
});
