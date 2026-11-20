// What a `value` field's `shown` reads (invariant I7): the state the page view
// prints after an element's words, from the source the view is printed from, so
// a column returns what the view says. A cinema's seat map and a timetable's
// class picker stand in for the pages; the fake DOM has no layout, so the
// cursor and the form controls are hand-set on the elements, as
// `../../../evidence/tests/` hand-builds its pages.

import assert from "node:assert/strict";
import test from "node:test";

const globals = globalThis as unknown as Record<string, unknown>;
/** A stand-in for a form control class that recognises the fake element by its tag, since the fake is no instance of anything. */
const controlClass = (tag: string) => class { static [Symbol.hasInstance](value: { tagName?: string }): boolean { return value.tagName === tag; } };
globals.HTMLInputElement = controlClass("INPUT");
globals.HTMLSelectElement = controlClass("SELECT");
globals.HTMLTextAreaElement = controlClass("TEXTAREA");
/** No layout here: an element's computed cursor is the one the test sets on it. */
globals.getComputedStyle = (target: { cursor?: string }) => ({ cursor: target.cursor });

const { fakeShadowDom } = await import("../../tests/fake-shadow-dom");
const { readField } = await import("../../field-reader");
const { normalizeExtractField } = await import("../../field-spec");

const dom = fakeShadowDom();
type Shown = "label" | "options" | "checked" | "disabled" | "marked";

/** A fake element with the properties the browser would give it. */
function element(tag: string, attributes: Record<string, string>, properties: Record<string, unknown> = {}, ...children: Array<Element | string>): Element {
  const made = dom.el(tag, attributes, ...children);
  return override(made, properties);
}

/** Sets properties the fake gives only as getters, as a browser's element has them. */
function override(made: Element, properties: Record<string, unknown>): Element {
  for (const [name, value] of Object.entries(properties)) Object.defineProperty(made, name, { value, configurable: true, writable: true });
  return made;
}

/** A selector for the item's one child, in the form the fake DOM reads. */
function childSelector(item: Element): string {
  return `:scope > ${item.children[0]!.tagName.toLowerCase()}`;
}

/** The field `shown` as the page reads it off the first element its selector finds inside the item. */
function read(item: Element, shown: Shown): string | null | undefined {
  const reader = normalizeExtractField("f", { kind: "value", selector: childSelector(item), shown });
  assert.ok(reader);
  return readField(item, "f", reader);
}

test("a seat whose cursor refuses a press reads disabled, as the view prints it, and a usable one reads nothing", () => {
  const taken = element("li", {}, {}, element("button", { class: "seat" }, { cursor: "not-allowed" }, "4C"));
  const free = element("li", {}, {}, element("button", { class: "seat" }, { cursor: "pointer" }, "4D"));
  assert.equal(read(taken, "disabled"), "disabled");
  assert.equal(read(free, "disabled"), null);
});

test("disabled also reads the attribute and aria-disabled the view prints it for", () => {
  assert.equal(read(element("li", {}, {}, element("button", { disabled: "" }, {}, "4C")), "disabled"), "disabled");
  assert.equal(read(element("li", {}, {}, element("div", { "aria-disabled": "true" }, {}, "4C")), "disabled"), "disabled");
  assert.equal(read(element("li", {}, {}, element("div", { "aria-disabled": "false" }, {}, "4C")), "disabled"), null);
});

test("the seat drawn apart from the like seats beside it reads marked, and the others nothing", () => {
  const seats = ["plain", "plain", "plain chosen", "plain"].map((classes) => {
    const names = classes.split(" ");
    return element("button", { class: classes }, { classList: Object.assign([...names], { contains: (name: string) => names.includes(name) }) }, "seat");
  });
  const row = element("li", {}, {}, ...seats);
  const marked = seats.map((_, index) => {
    const reader = normalizeExtractField("f", { kind: "value", selector: `:scope > button:nth-of-type(${index + 1})`, shown: "marked" });
    assert.ok(reader);
    return readField(row, "f", reader);
  });
  assert.deepEqual(marked, [null, null, "marked", null]);
});

test("a native checkbox reads its live checked state, where a value read would say on", () => {
  const checked = element("li", {}, {}, element("input", { type: "checkbox" }, { type: "checkbox", checked: true, value: "on" }));
  const unchecked = element("li", {}, {}, element("input", { type: "checkbox" }, { type: "checkbox", checked: false, value: "on" }));
  assert.equal(read(checked, "checked"), "checked");
  assert.equal(read(unchecked, "checked"), "unchecked");
  const stated = element("li", {}, {}, element("div", { role: "switch", "aria-checked": "true" }, {}));
  assert.equal(read(stated, "checked"), "checked");
  assert.equal(read(element("li", {}, {}, element("div", {}, {})), "checked"), null, "nothing states a check");
  const live = normalizeExtractField("f", { kind: "value", selector: childSelector(unchecked) });
  assert.equal(live && readField(unchecked, "f", live), null, "a plain value read of a checkbox with no value attribute still reads nothing");
});

test("a select reads the label of the chosen option and its option list, where its value is the option's value", () => {
  const options = [{ value: "m", label: "Matinee" }, { value: "e", label: "Evening" }];
  const picker = element("li", {}, {}, element("select", {}, { options, value: "e" }));
  assert.equal(read(picker, "label"), "Evening");
  assert.equal(read(picker, "options"), "Matinee|Evening");
  const plain = normalizeExtractField("f", { kind: "value", selector: childSelector(picker) });
  assert.equal(plain && readField(picker, "f", plain), "e", "the live value stays the option's value");
  const none = element("li", {}, {}, element("select", {}, { options, value: "other" }));
  assert.equal(read(none, "label"), null, "a selection that is none of the options says nothing");
  assert.equal(read(element("li", {}, {}, element("input", { type: "text" }, { type: "text", value: "x" })), "options"), null);
});

test("a sensitive select yields neither its label nor its options", () => {
  const options = [{ value: "m", label: "Matinee" }];
  const picker = element("li", {}, {}, element("select", { "data-sensitive": "true" }, { options, value: "m" }));
  assert.throws(() => read(picker, "label"), /sensitive/u);
});

test("an unknown shown reading is refused by the field the way an unknown mark is", () => {
  assert.throws(() => normalizeExtractField("f", { kind: "value", shown: "booked" as Shown }), /does not know/u);
});
