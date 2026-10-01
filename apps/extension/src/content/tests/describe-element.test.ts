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

// Nothing a reader is given is cut (t200). The text was cut at 500 characters,
// a value at 2,000, and a select's options at twenty, each value and label at
// 200 -- so a long consent notice, a long select of countries or a pasted
// paragraph reached the model as its first part, with no mark that it was.

test("an element's text is carried whole, however long", async () => {
  await withStubPage(load, ({ visibleText, directVisibleText }) => {
    const notice = "a".repeat(10_000);
    const paragraph = element("p", {}, notice);
    assert.equal(visibleText(paragraph)?.length, 10_000);
    assert.equal(directVisibleText(paragraph), notice);
    // A container's own words are whole too, beside a child's.
    const container = element("div", {}, `${notice} `, element("span", {}, "tail"));
    assert.equal(directVisibleText(container), notice);
    assert.equal(visibleText(container), `${notice} tail`);
  });
});

test("a control's value is carried whole, however long", async () => {
  await withStubPage(load, ({ readElementValue }) => {
    const pasted = "b".repeat(5_000);
    assert.equal(readElementValue(input("text", pasted)), pasted);
  });
});

test("a select lists every option, each value and label whole, and a selection past the twentieth", async () => {
  await withStubPage(load, ({ selectState }) => {
    const long = (index: number) => `${String(index).padStart(2, "0")}-${"c".repeat(300)}`;
    const options = Array.from({ length: 60 }, (_unused, index) => option(`value-${long(index)}`, `Label ${long(index)}`));
    const chosen = `value-${long(45)}`;
    const state = selectState(select({}, chosen, ...options));
    assert.equal(state?.options.length, 60, "the option list was cut");
    assert.deepEqual(state?.options[59], { value: `value-${long(59)}`, label: `Label ${long(59)}` });
    assert.equal(state?.selectedValue, chosen, "a selection past the twentieth option was dropped or cut");
  });
});

// `ownText` (t223): an element whose `text` is all its descendants' words also
// says which of them are its own, so a list item that only wraps a link reads
// as adding nothing to it. `isInteractableUiElement` asks the computed cursor
// of an element that is neither a control nor a text element, so the test
// answers it from a stand-in.

/** Runs `body` with `getComputedStyle` answering an ordinary cursor, and puts the global back. */
function withPlainCursor(body: () => void): void {
  const globals = globalThis as unknown as Record<string, unknown>;
  const previous = Object.getOwnPropertyDescriptor(globals, "getComputedStyle");
  globals.getComputedStyle = () => ({ cursor: "auto" });
  try {
    body();
  } finally {
    if (previous) Object.defineProperty(globals, "getComputedStyle", previous);
    else delete globals.getComputedStyle;
  }
}

test("ownText is a list item's, a paragraph's and a button's own words beside a text that holds their children's, and \"\" when they have none", async () => {
  await withStubPage(load, ({ ownTextBeside, visibleText }) => {
    const item = element("li", {}, "Wireless earbuds ", element("a", { href: "/p/1" }, "Buy now"));
    assert.equal(visibleText(item), "Wireless earbuds Buy now");
    assert.equal(ownTextBeside(item, visibleText(item)), "Wireless earbuds");
    const wrapper = element("li", {}, element("a", { href: "/" }, "Home"));
    assert.equal(ownTextBeside(wrapper, visibleText(wrapper)), "", "an item that only wraps a link has no words of its own");
    const paragraph = element("p", {}, "Ships in ", element("strong", {}, "2 days"));
    assert.equal(ownTextBeside(paragraph, visibleText(paragraph)), "Ships in");
    const button = element("button", {}, element("span", {}, "Add to cart"));
    assert.equal(ownTextBeside(button, visibleText(button)), "");
  });
});

test("ownText is absent where it would say what text says, and on an element whose text is already its own", async () => {
  await withStubPage(load, ({ ownTextBeside, visibleText, directVisibleText }) => {
    const plain = element("p", {}, "No results for kestrel");
    assert.equal(ownTextBeside(plain, visibleText(plain)), undefined);
    const button = element("button", {}, "Search");
    assert.equal(ownTextBeside(button, visibleText(button)), undefined);
    const empty = element("li", {});
    assert.equal(ownTextBeside(empty, visibleText(empty)), undefined, "no words at all is not a difference");
    withPlainCursor(() => {
      const container = element("div", {}, "Results ", element("span", {}, "12"));
      assert.equal(ownTextBeside(container, directVisibleText(container)), undefined, "a container's text is its own words already");
    });
  });
});

test("ownText follows the sensitive-text rule: nothing from inside a sensitive control", async () => {
  await withStubPage(load, ({ ownTextBeside, visibleText }) => {
    const inside = element("li", {}, "SYNTHETIC_SECRET_WORDS ", element("span", {}, "more"));
    element("div", { "data-sensitive": "true" }, inside);
    assert.equal(visibleText(inside), undefined);
    assert.equal(ownTextBeside(inside, visibleText(inside)), undefined);
    const beside = element("li", {}, "Recovery note ", element("textarea", { "data-sensitive": "true" }, "SYNTHETIC_RECOVERY_NOTE"));
    assert.equal(ownTextBeside(beside, visibleText(beside)), undefined, "the item's words are its own once the control's contents are left out");
  });
});
