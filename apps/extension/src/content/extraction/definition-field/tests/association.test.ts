import assert from "node:assert/strict";
import test from "node:test";
import { definitionAssociations } from "../association";
import { fakeShadowDom } from "../../tests/fake-shadow-dom";

const dom = fakeShadowDom();
const pair = (term: string, value: string) => dom.el("div", {}, dom.el("dt", {}, term), dom.el("dd", {}, value));

test("flat and grouped definition pairs retain their own term and unique value", () => {
  const list = dom.el("dl", {}, dom.el("dt", {}, "  Print\n size  "), dom.el("dd", {}, "A5"), pair("Binding", "Linen"));
  const found = definitionAssociations(dom.el("article", {}, list));
  assert.deepEqual(found.map(({ term, value }) => [term, value.textContent]), [["Print size", "A5"], ["Binding", "Linen"]]);
  const aliases = dom.el("dl", {}, dom.el("dt", {}, "Width"), dom.el("dt", {}, "Breadth"), dom.el("dd", {}, "24 cm"));
  assert.deepEqual(definitionAssociations(aliases).map(({ term }) => term), ["Width", "Breadth"]);
});

test("missing, duplicate and multi-value terms have no readable association", () => {
  const row = dom.el("article", {}, dom.el("dl", {}, pair("Finish", "Matte"), pair("Finish", "Satin"),
    dom.el("dt", {}, "No value"),
    dom.el("div", {}, dom.el("dt", {}, "Ambiguous"), dom.el("dd", {}, "One"), dom.el("dd", {}, "Two")),
    pair("Weight", "40 g")), dom.el("dl", {}, pair("Weight", "50 g")));
  assert.deepEqual(definitionAssociations(row), []);
});

test("nested lists never supply an outer term or contaminate its value", () => {
  const nested = dom.el("dl", { class: "inner" }, pair("Width", "9 cm"));
  const row = dom.el("article", {}, dom.el("dl", {}, dom.el("dt", {}, "Envelope"), dom.el("dd", {}, "Outer ", nested), pair("Height", "7 cm")));
  assert.deepEqual(definitionAssociations(row).map(({ term }) => term), ["Height"]);
  assert.deepEqual(definitionAssociations(row, "dl.inner").map(({ term, value }) => [term, value.textContent]), [["Width", "9 cm"]]);
});

test("selectors scope lists, never a positional term or the whole item as fallback", () => {
  const row = dom.el("article", {}, dom.el("section", { class: "front" }, dom.el("dl", {}, pair("Ink", "Blue"))),
    dom.el("dl", { class: "back" }, pair("Ink", "Black")));
  assert.deepEqual(definitionAssociations(row), []);
  assert.deepEqual(definitionAssociations(row, "section.front").map(({ value }) => value.textContent), ["Blue"]);
  assert.deepEqual(definitionAssociations(row, "dl.back").map(({ value }) => value.textContent), ["Black"]);
  assert.deepEqual(definitionAssociations(row, "dt"), []);
  assert.deepEqual(definitionAssociations(row, ".absent"), []);
});

test("hidden, sensitive and control content is screened before label text is accessed", () => {
  for (const attributes of [{ hidden: "" }, { "aria-hidden": "true" }, { inert: "" }, { "data-sensitive": "true" }]) {
    const label = dom.el("dt", attributes, "PRIVATE-LABEL");
    Object.defineProperty(label, "textContent", { get: () => { throw new Error("screened label read"); } });
    assert.deepEqual(definitionAssociations(dom.el("dl", {}, label, dom.el("dd", {}, "PRIVATE-VALUE"))), []);
  }
  const row = dom.el("article", {}, dom.el("dl", {},
    dom.el("div", {}, dom.el("dt", {}, "Hidden value"), dom.el("dd", { hidden: "" }, "PRIVATE-VALUE")),
    dom.el("div", {}, dom.el("dt", {}, "Secret value"), dom.el("dd", {}, dom.el("span", { "data-sensitive": "true" }, "PRIVATE-VALUE"))),
    dom.el("div", {}, dom.el("dt", {}, "Control value"), dom.el("dd", {}, dom.el("button", {}, "PRIVATE-VALUE")))));
  assert.deepEqual(definitionAssociations(row), []);
});

test("a hidden ancestor or computed hidden pair is unreadable and value text is never sampled by association", () => {
  const name = dom.el("dt", {}, "Paper");
  const value = dom.el("dd", {}, "PRIVATE-VALUE");
  Object.defineProperty(value, "textContent", { get: () => { throw new Error("association read a value"); } });
  const row = dom.el("article", {}, dom.el("dl", {}, name, value));
  assert.equal(definitionAssociations(row).length, 1);
  Object.defineProperty(name, "ownerDocument", { value: { defaultView: { getComputedStyle: () => ({ display: "none" }) } } });
  assert.deepEqual(definitionAssociations(row), []);
  const hiddenRow = dom.el("article", { hidden: "" }, dom.el("dl", {}, pair("Paper", "Smooth")));
  assert.deepEqual(definitionAssociations(hiddenRow), []);
});

test("fallback control roles and native editable forms block the term, its ancestors and its descendants before text access", () => {
  const blockedAttributes: Array<Record<string, string>> = [
    { role: "note TeXtBoX" }, { role: "CHECKBOX status" },
    { contenteditable: "" }, { contenteditable: "TRUE" }, { contenteditable: "Plaintext-Only" }
  ];
  for (const attributes of blockedAttributes) {
    for (const location of ["term", "parent", "descendant"] as const) {
      const name = dom.el("dt", location === "term" ? attributes : {},
        ...(location === "descendant" ? [dom.el("span", attributes, "PRIVATE-LABEL")] : ["PRIVATE-LABEL"]));
      Object.defineProperty(name, "textContent", { get: () => { throw new Error("editable/control label read"); } });
      const group = dom.el("div", location === "parent" ? attributes : {}, name, dom.el("dd", {}, "PRIVATE-VALUE"));
      assert.deepEqual(definitionAssociations(dom.el("dl", {}, group)), [], `${JSON.stringify(attributes)} ${location}`);
    }
    for (const location of ["value", "descendant"] as const) {
      const value = dom.el("dd", location === "value" ? attributes : {},
        ...(location === "descendant" ? [dom.el("span", attributes, "PRIVATE-VALUE")] : ["PRIVATE-VALUE"]));
      Object.defineProperty(value, "textContent", { get: () => { throw new Error("editable/control value read"); } });
      assert.deepEqual(definitionAssociations(dom.el("dl", {}, dom.el("dt", {}, "Paper"), value)), [], `${JSON.stringify(attributes)} ${location}`);
    }
  }
});

test("explicit contenteditable false and ordinary fallback roles remain readable", () => {
  for (const editable of ["false", "FALSE"]) {
    const row = dom.el("article", { contenteditable: editable, role: "note status" },
      dom.el("dl", {}, dom.el("dt", { contenteditable: editable }, "Paper"),
        dom.el("dd", {}, dom.el("span", { contenteditable: editable }, "Smooth"))));
    assert.deepEqual(definitionAssociations(row).map(({ term, value }) => [term, value.textContent]), [["Paper", "Smooth"]]);
  }
});
