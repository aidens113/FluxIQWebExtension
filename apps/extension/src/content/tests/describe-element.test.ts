// Two rules every capture path shares through this module.
//
// `readElementValue` withholds a file input's value, which is the chosen file's
// local name: every capture path -- the element descriptor, the snapshot, the
// recorder's `dom.input` and the `dom.change` listener -- reads values through
// it, so this one rule keeps the name on the page (P5's optional hardening,
// decided with open question 2).
//
// `visibleText` and `directVisibleText` give no sensitive control's contents:
// a sensitive control and anything inside one yield no text, and a container's
// text leaves those contents out. They are the descriptor's `text` and
// `visibleText`, and what the snapshot ranks and admits elements by (D2).
//
// The runner is Node, so the page is the hand-built stub in `stub-page.ts`.
// What only a real page proves -- that Chromium's `C:\fakepath\` value never
// reaches a recorded change, and that no snapshot quotes a sensitive control's
// contents -- is the content harness's.

import assert from "node:assert/strict";
import test from "node:test";
import { element, input, withStubPage } from "./stub-page";

const load = () => import("../describe-element");

test("a file input yields no value, so the chosen file's local name never leaves the page", async () => {
  await withStubPage(load, ({ readElementValue }) => {
    assert.equal(readElementValue(input("file", "C:\\fakepath\\expense-receipts.csv")), undefined);
    // The property is lowercase in a browser; the rule does not depend on it.
    assert.equal(readElementValue(input("FILE", "C:\\fakepath\\expense-receipts.csv")), undefined);
  });
});

test("the withholding is targeted: a text input's value is still read", async () => {
  await withStubPage(load, ({ readElementValue }) => {
    assert.equal(readElementValue(input("text", "Ada")), "Ada");
  });
});

/** `target` as an element of an editable region: `isContentEditable`, with its text as `innerText`. */
function editable(target: Element): Element {
  Object.defineProperties(target, { isContentEditable: { value: true }, innerText: { value: target.textContent } });
  return target;
}

test("an element inside a sensitive control yields no value: a span in a marked editable region, a field in a marked group", async () => {
  await withStubPage(load, ({ readElementValue }) => {
    // The span is editable because its region is, and is not marked itself: its words are the region's value.
    const words = editable(element("span", {}, "SYNTHETIC_DRAFT_WORDS"));
    editable(element("div", { "data-sensitive": "true" }, "Draft ", words));
    const field = input("text", "SYNTHETIC_FIELD_VALUE");
    element("div", { "data-sensitive": "true" }, field);
    assert.equal(readElementValue(words), undefined);
    assert.equal(readElementValue(field), undefined);
    // An ordinary editable region's words are still read.
    const plain = editable(element("span", {}, "Ada"));
    editable(element("div", {}, plain));
    assert.equal(readElementValue(plain), "Ada");
  });
});

test("visibleText and directVisibleText give nothing for a sensitive control or anything inside one", async () => {
  await withStubPage(load, ({ visibleText, directVisibleText }) => {
    const note = element("textarea", { "data-sensitive": "true" }, "SYNTHETIC_RECOVERY_NOTE");
    const option = element("option", {}, "SYNTHETIC_ANSWER_LABEL");
    element("select", { autocomplete: "one-time-code" }, option);
    for (const target of [note, option]) {
      assert.equal(visibleText(target), undefined);
      assert.equal(directVisibleText(target), undefined);
    }
  });
});

/** A checkbox or radio holding `checked`, which the stub input does not model. */
function toggle(type: string, checked: boolean): Element {
  const control = input(type, "on");
  Object.defineProperty(control, "checked", { value: checked });
  return control;
}

/** An `<option>` rendering `label` for `value`; the stub element models neither. */
function option(value: string, label: string): Element {
  const node = element("option", {}, label);
  Object.defineProperty(node, "value", { value });
  return node;
}

/** A `<select>` offering `options`, with `selected` as the value it currently holds. */
function select(attributes: Record<string, string>, selected: string, ...options: Element[]): Element {
  const node = element("select", attributes, ...options);
  Object.defineProperties(node, { options: { value: options }, value: { value: selected } });
  return node;
}

test("a checkbox or radio inside a sensitive control reports no checked state, and outside one still reports it", async () => {
  await withStubPage(load, ({ checkedState }) => {
    // Neither control is marked itself: the element around it is, and for these
    // two controls the checked state is everything they hold.
    const box = toggle("checkbox", true);
    element("div", { "data-sensitive": "true" }, box);
    assert.equal(checkedState(box), undefined);
    const choice = toggle("radio", true);
    element("fieldset", { "data-sensitive": "true" }, element("label", {}, choice));
    assert.equal(checkedState(choice), undefined);
    // The withholding is targeted: an ordinary toggle still reports both states,
    // and `false` is a state rather than an absence.
    assert.equal(checkedState(toggle("checkbox", true)), true);
    assert.equal(checkedState(toggle("checkbox", false)), false);
    // A control whose state is not what it holds reports none, marked or not.
    assert.equal(checkedState(input("text", "Ada")), undefined);
  });
});

test("a select inside a sensitive control lists no options and no selection, and outside one lists both", async () => {
  await withStubPage(load, ({ selectState }) => {
    // The options are the value space, so publishing them narrows the secret
    // even when the selection itself is withheld.
    const answer = select({}, "SYNTHETIC_ANSWER_VALUE", option("SYNTHETIC_ANSWER_VALUE", "SYNTHETIC_ANSWER_LABEL"));
    element("div", { "data-sensitive": "true" }, element("label", {}, answer));
    assert.equal(selectState(answer), undefined);
    // A select the rule marks itself was already withheld, and still is.
    const marked = select({ autocomplete: "one-time-code" }, "SYNTHETIC_ANSWER_VALUE", option("SYNTHETIC_ANSWER_VALUE", "SYNTHETIC_ANSWER_LABEL"));
    assert.equal(selectState(marked), undefined);
    // An ordinary select still carries its value space and what it holds.
    const contact = select({}, "mornings", option("mornings", "Mornings"), option("evenings", "Evenings"));
    assert.deepEqual(selectState(contact), {
      options: [{ value: "mornings", label: "Mornings" }, { value: "evenings", label: "Evenings" }],
      selectedValue: "mornings"
    });
    // A selection that is not one of the options listed would say more than the
    // list already did, so it is left off.
    assert.deepEqual(selectState(select({}, "removed", option("mornings", "Mornings"))), {
      options: [{ value: "mornings", label: "Mornings" }]
    });
  });
});

test("a container's text leaves those contents out and keeps its own words; an ordinary control's contents are kept", async () => {
  await withStubPage(load, ({ visibleText, directVisibleText }) => {
    const label = element("label", {}, "Recovery note ", element("textarea", { "data-sensitive": "true" }, "SYNTHETIC_RECOVERY_NOTE"));
    assert.equal(visibleText(label), "Recovery note");
    assert.equal(directVisibleText(label), "Recovery note");
    const ordinary = element("label", {}, "Contact time ", element("select", {}, element("option", {}, "Mornings")));
    assert.equal(visibleText(ordinary), "Contact time Mornings");
  });
});
