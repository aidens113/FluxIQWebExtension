// The words each kind of line prints.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmEvidenceElement } from "../../../elements";
import { webLlmElementWords } from "../words";

const BOX = { x: 10, y: 10, width: 100, height: 20 };
const el = (fields: Partial<WebLlmEvidenceElement> & { tag: string }): WebLlmEvidenceElement => ({ target: "t1", box: BOX, ...fields });

test("a control says the first of its name, text, label and title that says anything", () => {
  assert.equal(webLlmElementWords(el({ tag: "button", name: "Go", text: "Search" })), "Go");
  assert.equal(webLlmElementWords(el({ tag: "button", name: " ", text: "Search" })), "Search");
  assert.equal(webLlmElementWords(el({ tag: "input", label: "Email" })), "Email");
  assert.equal(webLlmElementWords(el({ tag: "input", attributes: [["placeholder", "Search the store"]] })), undefined, "a placeholder is not a name");
  assert.equal(webLlmElementWords(el({ tag: "a", href: "https://shop.test/", attributes: [["title", "Home"]] })), "Home");
  assert.equal(webLlmElementWords(el({ tag: "a", href: "https://shop.test/" })), undefined, "a control may have no words");
  assert.equal(webLlmElementWords(el({ tag: "a", href: "https://shop.test/", name: "$39.99$39.99" })), "$39.99", "W1 applies");
});

test("a semantic text line says all of its descendants' words; another says its own", () => {
  assert.equal(webLlmElementWords(el({ tag: "p", text: "Ships today. Learn more", ownText: "Ships today." })), "Ships today. Learn more");
  assert.equal(webLlmElementWords(el({ tag: "h2", name: "Kettle" })), "Kettle");
  assert.equal(webLlmElementWords(el({ tag: "div", text: "Deliver to DanaPortland", ownText: "Deliver to Dana" })), "Deliver to Dana");
});

test("an image says its alt, a layer its name", () => {
  assert.equal(webLlmElementWords(el({ tag: "img", name: "Brightaisle Plus" })), "Brightaisle Plus");
  assert.equal(webLlmElementWords(el({ tag: "div", isDialog: { modal: true }, name: "Cookie preferences", text: "We use cookies" })), "Cookie preferences");
  assert.equal(webLlmElementWords(el({ tag: "div", covers: ["t2"] })), undefined);
});

test("nothing is cut", () => {
  const long = Array.from({ length: 400 }, (_, index) => `word${index}`).join(" ");
  assert.equal(webLlmElementWords(el({ tag: "p", text: long })), long);
});

test("a name that is only the placeholder is not printed as the field's words; a label is (t229)", () => {
  const placeholder: Array<[string, string]> = [["placeholder", "Autumn Mega Sale: up to 70% off"]];
  assert.equal(webLlmElementWords(el({ tag: "input", name: "Autumn Mega Sale: up to 70% off", placeholderName: true, attributes: placeholder })), undefined);
  assert.equal(webLlmElementWords(el({ tag: "input", name: "Search", attributes: placeholder })), "Search");
  assert.equal(webLlmElementWords(el({ tag: "input", name: "Autumn Mega Sale: up to 70% off", placeholderName: true, label: "Quantity", attributes: placeholder })), "Quantity");
});
