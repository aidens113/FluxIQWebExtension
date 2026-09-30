// T1 coverage of a text field over words the page draws in an open shadow
// root, on the shape the professional network's sent invitations use: a row
// whose age is a childless `gl-time-ago` element with "Sent 1 month ago" in its
// shadow root and nowhere in the light DOM. Until 2026-09-30 a text field read
// `""` there, and a text field on the row read the row without its age.

import assert from "node:assert/strict";
import test from "node:test";
import { readField } from "../field-reader";
import { fakeShadowDom } from "./fake-shadow-dom";

const dom = fakeShadowDom();
const TEXT = { kind: "text", required: true } as const;

/** A sent connection request as the page draws it: the name, the headline, the age in a shadow root, and Withdraw. */
function sentRow(name: string, age: string): Element {
  const time = dom.shadow(dom.el("gl-time-ago", { datetime: "2026-08-19T08:00:00.000Z", format: "sent" }), dom.el("span", {}, age));
  return dom.el("li", { "data-entity-urn": "urn:gl:invitation:1" },
    dom.el("div", {}, dom.el("div", {}, dom.el("strong", {}, name)), " ", dom.el("div", {}, "Data engineer"), " ", time),
    " ",
    dom.el("div", {}, dom.el("button", { type: "button" }, "Withdraw")));
}

test("a text field on an element whose words are only in its open shadow root reads those words", () => {
  const row = sentRow("Aoife Brennan", "Sent 1 month ago");
  assert.equal(readField(row, "age", { ...TEXT, selector: "gl-time-ago" }), "Sent 1 month ago");
});

test("a text field on the row reads the shadow root's words where the page draws them, in document order", () => {
  const row = sentRow("Rosa Meijer", "Sent 4 weeks ago");
  assert.equal(readField(row, "row", TEXT), "Rosa Meijer Data engineer Sent 4 weeks ago Withdraw");
});

test("a sensitive control inside a shadow root is left out, as it is in the light DOM", () => {
  const host = dom.shadow(dom.el("x-note"), dom.el("span", {}, "Note: "), dom.el("textarea", { "data-sensitive": "true" }, "hunter2"));
  const row = dom.el("li", {}, host);
  assert.equal(readField(row, "note", TEXT), "Note:");
});

test("a component's stylesheet in its shadow root is not read as its text", () => {
  const host = dom.shadow(dom.el("x-badge"), dom.el("style", {}, ":host { color: red }"), dom.el("span", {}, "Sponsored"));
  assert.equal(readField(dom.el("li", {}, host), "badge", { ...TEXT, selector: "x-badge" }), "Sponsored");
});

test("a slot reads the light nodes assigned to it where it sits, and its fallback when none are", () => {
  const named = dom.el("b", {}, "Grace");
  const slot = dom.el("slot");
  const host = dom.el("x-greeting", {}, named);
  dom.shadow(host, "Hello, ", slot, "!");
  dom.assign(slot, named);
  assert.equal(readField(dom.el("li", {}, host), "greeting", TEXT), "Hello, Grace!");
  const empty = dom.shadow(dom.el("x-greeting"), "Hello, ", dom.el("slot", {}, "stranger"), "!");
  assert.equal(readField(dom.el("li", {}, empty), "greeting", TEXT), "Hello, stranger!");
});

test("an element with no shadow root anywhere in it reads exactly as it did", () => {
  const row = dom.el("li", {}, dom.el("span", {}, "  Kees   Bakker "), dom.el("script", {}, "x"));
  assert.equal(readField(row, "row", TEXT), "Kees Bakker x");
});

test("a read across a shadow root is bounded, so a huge component cannot make one field unbounded", () => {
  const words = Array.from({ length: 20_000 }, () => "w ");
  const host = dom.shadow(dom.el("x-huge"), ...words);
  const value = readField(dom.el("li", {}, host), "huge", TEXT) ?? "";
  assert.ok(value.length > 0 && value.length < words.join("").length, String(value.length));
});
