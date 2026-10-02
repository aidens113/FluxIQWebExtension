// What the line rules ask of one element: visible, control, layer, semantic, image, its own words.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmEvidenceElement } from "../../../elements";
import { webLlmViewTraits } from "../traits";

const BOX = { x: 10, y: 10, width: 100, height: 20 };
const el = (fields: Partial<WebLlmEvidenceElement> & { tag: string }): WebLlmEvidenceElement => ({ target: "t1", box: BOX, ...fields });

test("visible means not a hidden element a search added, and a box, if any, that reaches into the document", () => {
  assert.equal(webLlmViewTraits(el({ tag: "a" })).visible, true);
  assert.equal(webLlmViewTraits(el({ tag: "input", box: { x: -9768, y: 10, width: 9, height: 7 } })).visible, false, "the honeypot parked off the page");
  assert.equal(webLlmViewTraits(el({ tag: "div", box: { x: 0, y: -50, width: 10, height: 50 } })).visible, false, "a box ending at the top edge");
  assert.equal(webLlmViewTraits(el({ tag: "div", box: { x: -5, y: -5, width: 10, height: 10 } })).visible, true, "a box reaching in");
  assert.equal(webLlmViewTraits({ target: "t1", tag: "a" }).visible, true, "no box: an image map area, or a box that failed to measure, is still on the page");
  assert.equal(webLlmViewTraits(el({ tag: "a", hidden: true })).visible, false);
});

test("control is the view's own predicate", () => {
  const controls: Array<Partial<WebLlmEvidenceElement> & { tag: string }> = [
    { tag: "a", href: "https://shop.test/" }, { tag: "span", role: "link" }, { tag: "button" }, { tag: "select" }, { tag: "textarea" },
    { tag: "summary" }, { tag: "input" }, { tag: "input", inputType: "checkbox" }, { tag: "div", role: "combobox" },
    { tag: "div", role: "spinbutton" }, { tag: "ul", role: "listbox" }, { tag: "div", role: "menuitemradio" },
    { tag: "div", hasClickHandler: true }, { tag: "div", attributes: [["contenteditable", "true"]] }, { tag: "div", role: "button presentation" }
  ];
  for (const fields of controls) assert.equal(webLlmViewTraits(el(fields)).control, true, JSON.stringify(fields));
  const others: Array<Partial<WebLlmEvidenceElement> & { tag: string }> = [
    { tag: "a" }, { tag: "input", inputType: "hidden" }, { tag: "div", attributes: [["contenteditable", "false"]] },
    { tag: "option", implicitRole: "option" }, { tag: "div", role: "presentation" }, { tag: "label" }
  ];
  for (const fields of others) assert.equal(webLlmViewTraits(el(fields)).control, false, JSON.stringify(fields));
});

test("a layer is an open dialog or something drawn over other controls", () => {
  assert.equal(webLlmViewTraits(el({ tag: "div", isDialog: { modal: false } })).layer, true);
  assert.equal(webLlmViewTraits(el({ tag: "div", covers: ["t2"] })).layer, true);
  assert.equal(webLlmViewTraits(el({ tag: "div", coversCount: 4 })).layer, true);
  assert.equal(webLlmViewTraits(el({ tag: "div", coveredBy: ["t2"] })).layer, false);
});

test("own words are ownText, else text, else a semantic element's name", () => {
  assert.equal(webLlmViewTraits(el({ tag: "li", text: "Kettle $39.99", ownText: "" })).ownWords, "");
  assert.equal(webLlmViewTraits(el({ tag: "div", text: "Deliver to" })).ownWords, "Deliver to");
  assert.equal(webLlmViewTraits(el({ tag: "h2", name: "Kettle" })).ownWords, "Kettle");
  assert.equal(webLlmViewTraits(el({ tag: "span", name: "Kettle" })).ownWords, undefined, "only a semantic element falls back to its name");
});

test("the line an element gets: control, then layer, then text, then image", () => {
  assert.equal(webLlmViewTraits(el({ tag: "a", href: "https://shop.test/", covers: ["t3"] })).lineRole, "control");
  assert.equal(webLlmViewTraits(el({ tag: "div", isDialog: { modal: true } })).lineRole, "layer");
  assert.equal(webLlmViewTraits(el({ tag: "span", text: "★" })).lineRole, "text", "a symbol is meaningful");
  // A quantity stepper's plus and minus and a close glyph, drawn as plain text (bigbox, run 39).
  for (const glyph of ["+", "−", "×"]) assert.equal(webLlmViewTraits(el({ tag: "span", text: glyph })).lineRole, "text", `${glyph} is meaningful`);
  assert.equal(webLlmViewTraits(el({ tag: "span", text: "(—)" })).lineRole, undefined, "punctuation alone is not");
  assert.equal(webLlmViewTraits(el({ tag: "img", name: "Kettle" })).lineRole, "image");
  assert.equal(webLlmViewTraits(el({ tag: "img" })).lineRole, undefined, "an image without an alt says nothing");
  assert.equal(webLlmViewTraits(el({ tag: "li", text: "Kettle", ownText: "" })).lineRole, undefined, "a list item whose words are its children's");
});

test("an element with a cursor of its own is a control; a label with one is not (t229)", () => {
  const box = { x: 0, y: 0, width: 50, height: 20 };
  assert.equal(webLlmViewTraits({ target: "t1", tag: "div", cursor: "pointer", box }).lineRole, "control");
  assert.equal(webLlmViewTraits({ target: "t1", tag: "div", cursor: "not-allowed", text: "Sold out", box }).lineRole, "control");
  assert.equal(webLlmViewTraits({ target: "t1", tag: "label", cursor: "pointer", text: "Free shipping", box }).lineRole, "text");
});
