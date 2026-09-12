// src/output-nodes/tests/payloads.test.ts
import assert from "node:assert/strict";
import test from "node:test";

// src/output-nodes/targets.ts
function elementFingerprint(value) {
  const element = objectValue(value);
  if (!element) return void 0;
  const attributes = objectValue(element.attributes);
  return compact({
    selector: stringValue(element.selector),
    xpath: stringValue(element.xpath),
    id: stringValue(element.id),
    classNames: Array.isArray(element.classNames) ? element.classNames.filter((item) => typeof item === "string") : void 0,
    visibleText: stringValue(element.visibleText),
    tagName: stringValue(element.tagName),
    text: stringValue(element.text),
    value: stringValue(element.value),
    role: stringValue(element.role),
    name: stringValue(element.name),
    href: stringValue(element.href),
    inputType: stringValue(element.inputType),
    testId: elementTestId(element, attributes),
    accessibleName: stringValue(element.accessibleName) ?? stringValue(attributes?.["aria-label"]),
    label: stringValue(element.label),
    attributes
  });
}
function elementTestId(element, attributes) {
  return stringValue(element.testId) ?? stringValue(attributes?.["data-testid"]) ?? stringValue(attributes?.["data-test"]) ?? stringValue(attributes?.["data-cy"]);
}
function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== void 0));
}
function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function stringValue(value) {
  return typeof value === "string" ? value : void 0;
}
function numberValue(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}

// src/output-nodes/payloads.ts
function webAutomationOutputPayload(outputId, payload) {
  const element = elementFingerprint(payload.element);
  const selector = stringValue(element?.selector);
  const visualTarget = objectValue(payload.visualTarget);
  const target = compact({ ...element ? { element } : {}, ...visualTarget ? { visualTarget } : {} });
  const hasTarget = Object.keys(target).length > 0;
  if (outputId === "web.browser.navigate") return compact({ url: stringValue(payload.url) });
  if (outputId === "web.dom.click" || outputId === "web.dom.clear") return compact({ selector, ...hasTarget ? target : {} });
  if (outputId === "web.dom.type") return compact({ selector, text: stringValue(payload.inputValue) ?? "", ...hasTarget ? target : {} });
  if (outputId === "web.dom.select") return compact({ selector, value: stringValue(payload.inputValue) ?? "", ...hasTarget ? target : {} });
  if (outputId === "web.dom.keypress") return compact({ selector, key: stringValue(payload.key) ?? "", ...hasTarget ? target : {} });
  if (outputId === "web.dom.scroll") {
    const scroll = objectValue(payload.scroll);
    return compact({ x: numberValue(scroll?.x), y: numberValue(scroll?.y) });
  }
  if (outputId === "web.dom.check") {
    const checked = recordedCheckedState(payload);
    return compact({ selector, checked, ...hasTarget ? target : {} });
  }
  if (outputId === "web.dom.wait_for_selector") return compact({ selector, ...hasTarget ? target : {} });
  if (outputId === "web.dom.wait_for_text") return compact({ text: stringValue(payload.inputValue) ?? stringValue(payload.title) });
  if (outputId === "web.dom.extract") return compact({ selector, ...hasTarget ? target : {} });
  if (outputId === "web.dom.capture_snapshot") return {};
  return {};
}
function recordedCheckedState(payload) {
  const element = objectValue(payload.element);
  if (!element) return void 0;
  if (typeof element.checked === "boolean") return element.checked;
  const ariaChecked = stringValue(objectValue(element.attributes)?.["aria-checked"]);
  if (ariaChecked === "true") return true;
  if (ariaChecked === "false") return false;
  return isRadioElement(element) ? true : void 0;
}
function isRadioElement(element) {
  return stringValue(element.inputType)?.toLowerCase() === "radio" || stringValue(element.role)?.toLowerCase() === "radio";
}

// src/output-nodes/tests/payloads.test.ts
var checkbox = { selector: "input#terms", tagName: "input", inputType: "checkbox", id: "terms" };
var radio = { selector: "input#plan-team", tagName: "input", inputType: "radio", id: "plan-team" };
test("a checkbox with a recorded checked state maps to that state", () => {
  assert.equal(webAutomationOutputPayload("web.dom.check", { element: { ...checkbox, checked: true }, inputValue: "on" }).checked, true);
  assert.equal(webAutomationOutputPayload("web.dom.check", { element: { ...checkbox, checked: false }, inputValue: "on" }).checked, false);
});
test("a checkbox with no recorded state carries no state, rather than a guess", () => {
  const parameters = webAutomationOutputPayload("web.dom.check", { element: checkbox, inputValue: "on" });
  assert.equal("checked" in parameters, false, "the recorded value 'on' is the value attribute, not the checked state");
  assert.equal(parameters.selector, "input#terms", "the target is still recorded");
});
test("a custom control's aria-checked is a recorded state", () => {
  const widget = { selector: "#toggle", tagName: "div", role: "switch", attributes: { "aria-checked": "true" } };
  assert.equal(webAutomationOutputPayload("web.dom.check", { element: widget }).checked, true);
  assert.equal(webAutomationOutputPayload("web.dom.check", { element: { ...widget, attributes: { "aria-checked": "false" } } }).checked, false);
});
test("a radio needs no recorded state: its change can only mean selected", () => {
  assert.equal(webAutomationOutputPayload("web.dom.check", { element: radio, inputValue: "team" }).checked, true);
  assert.equal(webAutomationOutputPayload("web.dom.check", { element: { selector: "#r", tagName: "div", role: "radio" } }).checked, true);
});
test("a check keeps the fingerprint and visual target replay falls back on", () => {
  const visualTarget = { namespace: "web", statePath: "web.elements.terms", selector: "input#terms" };
  const parameters = webAutomationOutputPayload("web.dom.check", { element: { ...checkbox, checked: true, xpath: "/html/body/form/input" }, visualTarget });
  assert.equal(parameters.element.xpath, "/html/body/form/input");
  assert.deepEqual(parameters.visualTarget, visualTarget);
});
test("the dispatch-only actions have no recorded payload", () => {
  for (const outputId of ["web.dom.assert", "web.dom.extract_list", "web.dom.upload", "web.dom.dialog", "web.browser.tab", "web.browser.download"]) {
    assert.deepEqual(webAutomationOutputPayload(outputId, { element: checkbox, inputValue: "on" }), {}, outputId);
  }
});
