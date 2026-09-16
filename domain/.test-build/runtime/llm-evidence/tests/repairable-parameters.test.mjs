// domain/src/runtime/llm-evidence/tests/repairable-parameters.test.ts
import assert from "node:assert/strict";
import test from "node:test";

// domain/src/runtime/llm-evidence/limits.ts
import { AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES } from "fluxiq/automation-studio";
var WEB_LLM_EVIDENCE_BYTE_BUDGETS = Object.freeze({
  ceiling: 12e3,
  exploration: 6e3,
  failure: AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES
});
var WEB_LLM_EVIDENCE_BOUNDS = Object.freeze({
  elements: 40,
  url: 2e3,
  text: 300,
  selector: 500,
  tag: 40,
  role: 80,
  attribute: 200,
  options: 20,
  placement: 80,
  dialogs: 3
});

// domain/src/runtime/llm-evidence/elements.ts
function safeFillTag(tag, inputType) {
  return tag === "textarea" || tag === "input" && (!inputType || ["text", "search", "email", "tel", "url", "number"].includes(inputType));
}
function actionableEvidenceElement(element2) {
  if (["button", "a", "summary", "select", "textarea"].includes(element2.tag)) return true;
  if (element2.tag === "input") return element2.inputType !== "hidden";
  return ["button", "link", "checkbox", "radio", "option", "switch", "tab", "menuitem", "treeitem"].includes(element2.role ?? "");
}

// domain/src/runtime/llm-evidence/repairable-parameters.ts
var WEB_REPAIRABLE_ELEMENT_PARAMETER = "element";
var WEB_REPAIRABLE_ITEM_PARAMETER = "item";
var WEB_REPAIRABLE_FIELD_PARAMETER_PREFIX = "field.";
var ELEMENT_ROLE_BY_DEFINITION_ID = {
  "web.output.dom-type": "fillable",
  "web.output.dom-clear": "fillable",
  "web.output.dom-select": "selectable",
  "web.output.dom-click": "clickable",
  "web.output.dom-keypress": "keyable",
  "web.output.dom-wait_for_selector": "observable",
  "web.output.dom-extract": "observable"
};
var LIST_EXTRACTION_DEFINITION_ID = "web.output.dom-extract_list";
function webRepairableParameters(definitionId) {
  const elementRole = ELEMENT_ROLE_BY_DEFINITION_ID[definitionId];
  if (elementRole) return [{ name: WEB_REPAIRABLE_ELEMENT_PARAMETER, role: elementRole, required: true }];
  if (definitionId === LIST_EXTRACTION_DEFINITION_ID) return [{ name: WEB_REPAIRABLE_ITEM_PARAMETER, role: "list_item", required: true }];
  return [];
}
function webRepairableParameterFor(definitionId, name) {
  const declared = webRepairableParameters(definitionId).find((parameter) => parameter.name === name);
  if (declared) return declared;
  if (definitionId !== LIST_EXTRACTION_DEFINITION_ID || !isFieldParameterName(name)) return void 0;
  return { name, role: "observable", required: false };
}
function elementFillsRepairableParameter(element2, role) {
  if (role === "fillable") return safeFillTag(element2.tag, element2.inputType);
  if (role === "selectable") return element2.tag === "select";
  if (role === "clickable") return actionableEvidenceElement(element2);
  if (role === "keyable") return safeFillTag(element2.tag, element2.inputType) || element2.tag === "select" || actionableEvidenceElement(element2);
  if (role === "list_item") return element2.item !== void 0;
  return true;
}
function isFieldParameterName(name) {
  if (!name.startsWith(WEB_REPAIRABLE_FIELD_PARAMETER_PREFIX)) return false;
  const key = name.slice(WEB_REPAIRABLE_FIELD_PARAMETER_PREFIX.length);
  return key.length > 0 && key.length <= 40 && /^[A-Za-z0-9](?:[A-Za-z0-9_.:-]*[A-Za-z0-9])?$/u.test(key);
}

// domain/src/runtime/llm-evidence/tool-rejection.ts
var WEB_LLM_TOOL_REJECTION_CODES = [
  "invalid_input",
  "cross_origin",
  "no_progress",
  "target_unobserved",
  "target_unsafe",
  "sensitive_value"
];

// domain/src/runtime/llm-evidence/vocabulary.ts
var WEB_LLM_EVIDENCE_TOOL_IDS = ["web.inspect_current_page", "web.navigate_same_origin", "web.reveal_safe"];
var WEB_LLM_INSPECT_TOOL_ID = WEB_LLM_EVIDENCE_TOOL_IDS[0];
var WEB_LLM_NAVIGATE_TOOL_ID = WEB_LLM_EVIDENCE_TOOL_IDS[1];
var WEB_LLM_REVEAL_TOOL_ID = WEB_LLM_EVIDENCE_TOOL_IDS[2];
var WEB_LLM_INSPECT_RESULT_CODE = "web.inspect.succeeded";
var WEB_LLM_ACTION_RESULT_CODE = "web.action.succeeded";
var REJECTION_RESULT_CODE_PREFIX = "web.action.rejected.";
function webLlmToolRejectionResultCode(code) {
  return `${REJECTION_RESULT_CODE_PREFIX}${code}`;
}
var WEB_LLM_EVIDENCE_RESULT_CODES = Object.freeze([
  WEB_LLM_INSPECT_RESULT_CODE,
  WEB_LLM_ACTION_RESULT_CODE,
  ...WEB_LLM_TOOL_REJECTION_CODES.map(webLlmToolRejectionResultCode)
]);

// domain/src/runtime/llm-evidence/tests/repairable-parameters.test.ts
var element = (fields) => ({ target: "target.1", tag: "div", ...fields });
test("every declared parameter name is a name Core will carry as a handle key", () => {
  const coreHandleKey = /^[A-Za-z0-9](?:[A-Za-z0-9_.:-]*[A-Za-z0-9])?$/u;
  const definitionIds = [
    "web.output.dom-type",
    "web.output.dom-clear",
    "web.output.dom-select",
    "web.output.dom-click",
    "web.output.dom-keypress",
    "web.output.dom-wait_for_selector",
    "web.output.dom-extract",
    "web.output.dom-extract_list"
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
  assert.equal(webRepairableParameterFor("web.output.dom-click", "field.price"), void 0);
  assert.equal(webRepairableParameterFor("web.output.dom-extract_list", "field."), void 0);
  assert.equal(webRepairableParameterFor("web.output.dom-extract_list", "field.#price"), void 0);
  assert.equal(webRepairableParameterFor("web.output.dom-extract_list", "field.a b"), void 0);
  assert.equal(webRepairableParameterFor("web.output.dom-extract_list", `field.${"x".repeat(41)}`), void 0);
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
