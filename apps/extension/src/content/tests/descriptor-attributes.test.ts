// Every attribute the page wrote travels on the descriptor, whole, in the order
// the page wrote them (t200) -- and what a sensitive control holds does not.
//
// The descriptor carried a 25-name allow-list at 500 characters a value, so an
// attribute outside the list (`data-state`, `aria-checked`, `srcdoc`) never
// reached a reader and a long one reached it cut. The runner is Node, so the
// page is the hand-built stub in `stub-page.ts`; what only a real page proves is
// the content harness's.

import assert from "node:assert/strict";
import test from "node:test";
import { element, input, withStubPage } from "./stub-page";

const load = async () => ({ ...(await import("../descriptor-attributes")), ...(await import("../capture-settings")) });

test("every attribute is carried, in source order, each value whole", async () => {
  await withStubPage(load, ({ elementAttributes }) => {
    const long = "d".repeat(10_000);
    const cell = element("td", {
      headers: "col-price",
      "data-state": "open",
      "aria-checked": "mixed",
      "data-long": long,
      selector: "not-a-selector",
      onclick: "go()"
    });
    const attributes = elementAttributes(cell);
    assert.deepEqual(Object.keys(attributes ?? {}), ["headers", "data-state", "aria-checked", "data-long", "selector", "onclick"]);
    assert.equal(attributes?.["data-long"], long, "an attribute value was cut");
    assert.equal(attributes?.["headers"], "col-price");
  });
});

test("an element with no attributes carries none, rather than an empty record", async () => {
  await withStubPage(load, ({ elementAttributes }) => {
    assert.equal(elementAttributes(element("div")), undefined);
  });
});

test("an attribute named like an object's prototype is carried as an attribute", async () => {
  await withStubPage(load, ({ elementAttributes }) => {
    // Parsed rather than written as a literal, which would set a prototype
    // instead of naming an attribute.
    const written = JSON.parse('{"__proto__":"page-wrote-this","id":"x"}') as Record<string, string>;
    const attributes = elementAttributes(element("div", written));
    assert.ok(attributes);
    assert.equal(Object.getPrototypeOf(attributes), Object.prototype, "the record's prototype was replaced by a page attribute");
    assert.equal(Object.getOwnPropertyDescriptor(attributes, "__proto__")?.value, "page-wrote-this");
    assert.deepEqual(Object.keys(attributes), ["__proto__", "id"]);
  });
});

test("what a sensitive control holds is withheld from its attributes, and what it is stays", async () => {
  await withStubPage(load, ({ elementAttributes }) => {
    const password = input("password", "SYNTHETIC_SECRET", { name: "pw", value: "SYNTHETIC_SECRET", "aria-label": "Password" });
    const passwordAttributes = elementAttributes(password);
    assert.equal(passwordAttributes?.["value"], undefined);
    assert.equal(passwordAttributes?.["name"], "pw");
    assert.equal(passwordAttributes?.["aria-label"], "Password");

    // Inside a marked group, the controls are not marked themselves; what they
    // hold is still the group's.
    const box = input("checkbox", "on", { checked: "", value: "SYNTHETIC_CHOICE" });
    const slider = element("div", { role: "slider", "aria-valuenow": "42", "aria-valuetext": "SYNTHETIC_AMOUNT" });
    const answer = element("option", { value: "SYNTHETIC_ANSWER", label: "SYNTHETIC_ANSWER_LABEL", selected: "" });
    element("div", { "data-sensitive": "true" }, box, slider, element("select", {}, answer));
    for (const inside of [box, slider, answer]) {
      const serialized = JSON.stringify(elementAttributes(inside) ?? {});
      assert.equal(serialized.includes("SYNTHETIC"), false, `${serialized} carries what a sensitive control holds`);
    }
    assert.equal(elementAttributes(slider)?.["role"], "slider", "what the control is still travels");
    assert.equal("checked" in (elementAttributes(box) ?? {}), false);
    assert.equal("selected" in (elementAttributes(answer) ?? {}), false);
  });
});

test("an ordinary control's value attribute travels, and is withheld from a text control while input-value capture is off", async () => {
  await withStubPage(load, ({ elementAttributes, captureSettings }) => {
    const field = input("text", "Ada", { value: "Ada" });
    const submit = input("submit", "Send", { value: "Send" });
    assert.equal(elementAttributes(field)?.["value"], "Ada");
    const previous = captureSettings.inputValues;
    captureSettings.inputValues = false;
    try {
      assert.equal(elementAttributes(field)?.["value"], undefined);
      // A button's value is the words on it, not something a person entered.
      assert.equal(elementAttributes(submit)?.["value"], "Send");
    } finally {
      captureSettings.inputValues = previous;
    }
  });
});
