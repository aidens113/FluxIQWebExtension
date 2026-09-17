import assert from "node:assert/strict";
import test from "node:test";
import {
  elementFillsRepairableParameter,
  webRepairableParameterFor,
  webRepairableParameters,
  WEB_REPAIRABLE_ELEMENT_PARAMETER,
  type WebLlmEvidenceElement,
} from "..";
import { webFailedActionDefinitionId, webFailureRepairParameters } from "../repairable-parameters";

const element = (fields: Partial<WebLlmEvidenceElement>): WebLlmEvidenceElement =>
  ({ target: "target.1", tag: "div", ...fields });

/** What every one-target DOM output tells a model its one parameter is. */
const elementDescription = (): string => webRepairableParameters("web.output.dom-click")[0]!.description;

test("every declared parameter name is a name Core will carry as a handle key, and says what its handle is", () => {
  const coreHandleKey = /^[A-Za-z0-9](?:[A-Za-z0-9_.:-]*[A-Za-z0-9])?$/u;
  const definitionIds = [
    "web.output.dom-type", "web.output.dom-clear", "web.output.dom-select", "web.output.dom-click",
    "web.output.dom-keypress", "web.output.dom-wait_for_selector", "web.output.dom-extract",
  ];
  for (const definitionId of definitionIds) {
    const declared = webRepairableParameters(definitionId);
    assert.ok(declared.length > 0, definitionId);
    for (const parameter of declared) {
      assert.match(parameter.name, coreHandleKey, `${definitionId} ${parameter.name}`);
      assert.ok(parameter.name.length <= 64, parameter.name);
      // A model reads this to learn what to put under the key: a handle it was shown.
      assert.match(parameter.description, /target handle/u, `${definitionId} ${parameter.name}`);
    }
  }
  assert.deepEqual(webRepairableParameters("web.output.browser-navigate"), []);
  assert.deepEqual(webRepairableParameters("web.output.dom-extract_list"), []);
  assert.deepEqual(webRepairableParameters(""), []);
  // A name every object inherits is not a declared action.
  for (const inherited of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
    assert.deepEqual(webRepairableParameters(inherited), [], inherited);
  }
});

test("a one-target DOM output declares exactly one element parameter, with the verb it has to carry", () => {
  const description = elementDescription();
  assert.deepEqual(webRepairableParameters("web.output.dom-type"), [{ name: WEB_REPAIRABLE_ELEMENT_PARAMETER, role: "fillable", required: true, description }]);
  assert.deepEqual(webRepairableParameters("web.output.dom-select"), [{ name: WEB_REPAIRABLE_ELEMENT_PARAMETER, role: "selectable", required: true, description }]);
  assert.deepEqual(webRepairableParameters("web.output.dom-click"), [{ name: WEB_REPAIRABLE_ELEMENT_PARAMETER, role: "clickable", required: true, description }]);
  assert.deepEqual(webRepairableParameters("web.output.dom-wait_for_selector"), [{ name: WEB_REPAIRABLE_ELEMENT_PARAMETER, role: "observable", required: true, description }]);
});

test("a list extraction declares nothing a target repair may re-point", () => {
  // Its row and its fields were once offered here, and a repair of them was
  // saved where the extract node never reads (D-4). Declaring nothing is what
  // makes the refusal plain rather than the repair silently inert.
  const listExtraction = "web.output.dom-extract_list";
  assert.deepEqual(webRepairableParameters(listExtraction), []);
  for (const name of ["item", "field.price", "field.a-b_c.d", WEB_REPAIRABLE_ELEMENT_PARAMETER]) {
    assert.equal(webRepairableParameterFor(listExtraction, name), undefined, name);
  }
  // Nor does any other action take a row or a field.
  assert.equal(webRepairableParameterFor("web.output.dom-click", "field.price"), undefined);
  assert.equal(webRepairableParameterFor("web.output.dom-click", "item"), undefined);
});

test("a declared parameter is found by its name, and nothing else is", () => {
  const description = elementDescription();
  assert.deepEqual(webRepairableParameterFor("web.output.dom-click", WEB_REPAIRABLE_ELEMENT_PARAMETER), { name: WEB_REPAIRABLE_ELEMENT_PARAMETER, role: "clickable", required: true, description });
  assert.deepEqual(webRepairableParameterFor("web.output.dom-type", WEB_REPAIRABLE_ELEMENT_PARAMETER), { name: WEB_REPAIRABLE_ELEMENT_PARAMETER, role: "fillable", required: true, description });
  assert.equal(webRepairableParameterFor("web.output.dom-click", "button"), undefined);
  assert.equal(webRepairableParameterFor("web.output.browser-navigate", WEB_REPAIRABLE_ELEMENT_PARAMETER), undefined);
});

// A recorded action is Core's `builtin.policy.action` whatever it does, so the
// output it dispatches is the verb. The definition id is all there is where
// Core names no output.
test("the failed action is the output it dispatches where Core names one, and its node otherwise", () => {
  assert.equal(webFailedActionDefinitionId({ definitionId: "web.output.dom-click" }), "web.output.dom-click");
  assert.equal(webFailedActionDefinitionId({ definitionId: "builtin.policy.action" }), "builtin.policy.action");
  assert.equal(webFailedActionDefinitionId({ definitionId: "builtin.policy.action", outputId: "web.dom.click" }), "web.output.dom-click");
  assert.equal(webFailedActionDefinitionId({ definitionId: "builtin.policy.action", outputId: "web.dom.extract_list" }), "web.output.dom-extract_list");
  assert.equal(webFailedActionDefinitionId({ definitionId: "web.output.dom-type", outputId: "web.dom.type" }), "web.output.dom-type");
  // An output this domain never registered, a node id passed as an output, and
  // a node that claims an output it cannot carry name no verb to trust.
  assert.equal(webFailedActionDefinitionId({ definitionId: "builtin.policy.action", outputId: "vendor.output.press" }), undefined);
  assert.equal(webFailedActionDefinitionId({ definitionId: "builtin.policy.action", outputId: "web.output.dom-click" }), undefined);
  assert.equal(webFailedActionDefinitionId({ definitionId: "web.output.dom-extract_list", outputId: "web.dom.click" }), undefined);
  assert.equal(webFailedActionDefinitionId({ definitionId: "builtin.llm.prompt", outputId: "web.dom.click" }), undefined);
});

// Core tells the model to fill one handle per parameter the failure evidence
// offers. A packet that offered none left it to guess the key, and a correct
// live repair was refused for naming the wrong one (`run-mu4tfxld-e78debce`).
test("a failure packet offers the parameters the failed action declares, and `element` where the verb is not known yet", () => {
  const offersElement = { [WEB_REPAIRABLE_ELEMENT_PARAMETER]: elementDescription() };
  assert.deepEqual(webFailureRepairParameters({ definitionId: "web.output.dom-click" }), offersElement);
  assert.deepEqual(webFailureRepairParameters({ definitionId: "web.output.dom-type" }), offersElement);
  assert.deepEqual(webFailureRepairParameters({ definitionId: "builtin.policy.action", outputId: "web.dom.click" }), offersElement);
  // Core's capture request names no output, so a recorded action's verb is not
  // known when the packet is written. It is offered the one parameter every
  // repairable action has; the check, which is told the output, refuses the rest.
  assert.deepEqual(webFailureRepairParameters({ definitionId: "builtin.policy.action" }), offersElement);
  // An action that is known to offer nothing says so with an empty map.
  assert.deepEqual(webFailureRepairParameters({ definitionId: "web.output.dom-extract_list" }), {});
  assert.deepEqual(webFailureRepairParameters({ definitionId: "builtin.policy.action", outputId: "web.dom.extract_list" }), {});
  assert.deepEqual(webFailureRepairParameters({ definitionId: "web.output.browser-navigate" }), {});
  assert.deepEqual(webFailureRepairParameters({ definitionId: "builtin.data.constant" }), {});
  assert.deepEqual(webFailureRepairParameters({ definitionId: "builtin.policy.action", outputId: "vendor.output.press" }), {});
});

test("a role is checked against what the element actually is", () => {
  assert.equal(elementFillsRepairableParameter(element({ tag: "textarea" }), "fillable"), true);
  assert.equal(elementFillsRepairableParameter(element({ tag: "input", inputType: "password" }), "fillable"), false);
  assert.equal(elementFillsRepairableParameter(element({ tag: "select" }), "selectable"), true);
  assert.equal(elementFillsRepairableParameter(element({ tag: "textarea" }), "selectable"), false);
  assert.equal(elementFillsRepairableParameter(element({ tag: "button" }), "clickable"), true);
  assert.equal(elementFillsRepairableParameter(element({ tag: "p" }), "clickable"), false);
  assert.equal(elementFillsRepairableParameter(element({ tag: "select" }), "keyable"), true);
  assert.equal(elementFillsRepairableParameter(element({ tag: "p" }), "observable"), true);
});
