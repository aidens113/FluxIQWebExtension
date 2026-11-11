// An item the browser does not render yields no value (t903): a person opens a closed menu
// before reading it, and so does FluxIQ, with a hover or a click. The browser's own
// `checkVisibility` says which; an element offering no measure is taken as shown.

import assert from "node:assert/strict";
import test from "node:test";
import { isRenderedItem, readRecord, type FieldReaders } from "..";
import { fakeShadowDom } from "../../tests/fake-shadow-dom";

const dom = fakeShadowDom();

function line(shown: boolean | undefined): Element {
  const element = dom.el("p", { "data-testid": "saved-lists" }, "Saved lists: Winter coats; Desk lamps");
  if (shown !== undefined) Object.assign(element, { checkVisibility: () => shown });
  return element;
}

test("a not-rendered item reads no field: an optional one is null, a required one is missing", () => {
  const fields: FieldReaders = [["saved", { kind: "text", selector: ":scope", required: false }], ["kept", { kind: "text", selector: ":scope", required: true }]];
  assert.deepEqual(readRecord(line(false), fields, "complete"), { record: { saved: null }, missing: ["kept"] });
  assert.deepEqual(readRecord(line(true), fields, "complete").record, { saved: "Saved lists: Winter coats; Desk lamps", kept: "Saved lists: Winter coats; Desk lamps" });
});

test("only the browser's word makes an item hidden", () => {
  assert.equal(isRenderedItem(line(false)), false);
  assert.equal(isRenderedItem(line(true)), true);
  assert.equal(isRenderedItem(line(undefined)), true);
});
