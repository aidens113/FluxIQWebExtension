import assert from "node:assert/strict";
import test from "node:test";
import {
  elementFillsRepairableParameter,
  webRepairableParameterFor,
  webRepairableParameters,
  WEB_REPAIRABLE_ELEMENT_PARAMETER,
  WEB_REPAIRABLE_ITEM_PARAMETER,
  type WebLlmEvidenceElement,
} from "..";

const element = (fields: Partial<WebLlmEvidenceElement>): WebLlmEvidenceElement =>
  ({ target: "target.1", tag: "div", ...fields });

test("every declared parameter name is a name Core will carry as a handle key", () => {
  const coreHandleKey = /^[A-Za-z0-9](?:[A-Za-z0-9_.:-]*[A-Za-z0-9])?$/u;
  const definitionIds = [
    "web.output.dom-type", "web.output.dom-clear", "web.output.dom-select", "web.output.dom-click",
    "web.output.dom-keypress", "web.output.dom-wait_for_selector", "web.output.dom-extract", "web.output.dom-extract_list",
  ];
  for (const definitionId of definitionIds) {
    const declared = webRepairableParameters(definitionId);
    assert.ok(declared.length > 0, definitionId);
    for (const parameter of declared) {
      assert.match(parameter.name, coreHandleKey, `${definitionId} ${parameter.name}`);
      assert.ok(parameter.name.length <= 64, parameter.name);
    }
  }
  assert.deepEqual(webRepairableParameters("web.output.browser-navigate"), []);
  assert.deepEqual(webRepairableParameters(""), []);
});

test("a one-target DOM output declares exactly one element parameter, with the verb it has to carry", () => {
  assert.deepEqual(webRepairableParameters("web.output.dom-type"), [{ name: WEB_REPAIRABLE_ELEMENT_PARAMETER, role: "fillable", required: true }]);
  assert.deepEqual(webRepairableParameters("web.output.dom-select"), [{ name: WEB_REPAIRABLE_ELEMENT_PARAMETER, role: "selectable", required: true }]);
  assert.deepEqual(webRepairableParameters("web.output.dom-click"), [{ name: WEB_REPAIRABLE_ELEMENT_PARAMETER, role: "clickable", required: true }]);
  assert.deepEqual(webRepairableParameters("web.output.dom-wait_for_selector"), [{ name: WEB_REPAIRABLE_ELEMENT_PARAMETER, role: "observable", required: true }]);
});

test("a list extraction declares its row, and accepts a field parameter per declared field key", () => {
  assert.deepEqual(webRepairableParameters("web.output.dom-extract_list"), [{ name: WEB_REPAIRABLE_ITEM_PARAMETER, role: "list_item", required: true }]);
  assert.deepEqual(webRepairableParameterFor("web.output.dom-extract_list", "field.price"), { name: "field.price", role: "observable", required: false });
  assert.deepEqual(webRepairableParameterFor("web.output.dom-extract_list", "field.a-b_c.d"), { name: "field.a-b_c.d", role: "observable", required: false });
  // A field parameter is only a field parameter for the action that has fields.
  assert.equal(webRepairableParameterFor("web.output.dom-click", "field.price"), undefined);
  // And only where the key is a name rather than anything wider.
  assert.equal(webRepairableParameterFor("web.output.dom-extract_list", "field."), undefined);
  assert.equal(webRepairableParameterFor("web.output.dom-extract_list", "field.#price"), undefined);
  assert.equal(webRepairableParameterFor("web.output.dom-extract_list", "field.a b"), undefined);
  assert.equal(webRepairableParameterFor("web.output.dom-extract_list", `field.${"x".repeat(41)}`), undefined);
});

test("a role is checked against what the element actually is", () => {
  assert.equal(elementFillsRepairableParameter(element({ tag: "textarea" }), "fillable"), true);
  assert.equal(elementFillsRepairableParameter(element({ tag: "input", inputType: "password" }), "fillable"), false);
  assert.equal(elementFillsRepairableParameter(element({ tag: "select" }), "selectable"), true);
  assert.equal(elementFillsRepairableParameter(element({ tag: "textarea" }), "selectable"), false);
  assert.equal(elementFillsRepairableParameter(element({ tag: "button" }), "clickable"), true);
  assert.equal(elementFillsRepairableParameter(element({ tag: "p" }), "clickable"), false);
  assert.equal(elementFillsRepairableParameter(element({ tag: "select" }), "keyable"), true);
  assert.equal(elementFillsRepairableParameter(element({ tag: "li", item: { index: 1, total: 4 } }), "list_item"), true);
  assert.equal(elementFillsRepairableParameter(element({ tag: "li" }), "list_item"), false);
  assert.equal(elementFillsRepairableParameter(element({ tag: "p" }), "observable"), true);
});
