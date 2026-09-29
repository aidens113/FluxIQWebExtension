// Which form controls hold a value of the record. The rule reads a tag and two
// attributes, so it is proven here without a document. What a cart line's
// detection offers because of it is proven by
// `e2e/content/tests/extraction/tests/cart-column-labels.spec.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { recordControlType } from "../record-control";

function element(tagName: string, attributes: Record<string, string> = {}): Pick<Element, "tagName" | "getAttribute" | "hasAttribute"> {
  return {
    tagName: tagName.toUpperCase(),
    getAttribute: (name: string) => attributes[name] ?? null,
    hasAttribute: (name: string) => Object.hasOwn(attributes, name)
  };
}

test("a checkbox or radio button with no value attribute is not a record value, since it reads the constant \"on\"", () => {
  assert.equal(recordControlType(element("input", { type: "checkbox", "aria-label": "Select item" })), undefined);
  assert.equal(recordControlType(element("input", { type: "RADIO" })), undefined);
});

test("a checkbox or radio button the page gave a value is one, and says it is a checkbox", () => {
  assert.equal(recordControlType(element("input", { type: "checkbox", value: "sku-1" })), "checkbox");
  assert.equal(recordControlType(element("input", { type: "radio", value: "" })), "radio");
});

test("a button-like or file input is not a record value", () => {
  for (const type of ["button", "submit", "reset", "image", "file"]) {
    assert.equal(recordControlType(element("input", { type, value: "Buy" })), undefined, type);
  }
});

test("a control a person types or chooses in is described by its type", () => {
  assert.equal(recordControlType(element("input", { type: "number" })), "number");
  assert.equal(recordControlType(element("input")), "text");
  assert.equal(recordControlType(element("input", { type: "hidden", value: "42" })), "hidden");
  assert.equal(recordControlType(element("input", { type: "not a type!" })), "text");
  assert.equal(recordControlType(element("select")), "select");
  assert.equal(recordControlType(element("textarea")), "textarea");
});

test("anything that is not a form control has no control type", () => {
  assert.equal(recordControlType(element("span", { value: "1" })), undefined);
  assert.equal(recordControlType(element("button", { value: "1" })), undefined);
});
