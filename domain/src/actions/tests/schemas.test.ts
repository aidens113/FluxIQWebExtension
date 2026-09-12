// T1 coverage of the action parameter registry: one case per action added in
// Week 1 (decision D6), plus the parameters D6 added to the original eleven.
//
// The rule every case enforces is the same: a parameter is named and shaped as
// the field of `WebAutomationActionCommand` it becomes, so a Flow's parameters
// reach the verb that runs them without being reshaped on the way. A schema
// that drifts from the command type is a silently unexecutable action.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationActionDefinitions } from "../schemas";
import { WEB_AUTOMATION_ACTION_TYPES, WEB_AUTOMATION_EXTRACT_MAX_PAGES, type WebAutomationActionType } from "../types";

function definitionFor(actionType: WebAutomationActionType) {
  const definition = webAutomationActionDefinitions.find((candidate) => candidate.actionType === actionType);
  assert.ok(definition, `${actionType} has no parameter definition`);
  return definition;
}

function propertiesOf(actionType: WebAutomationActionType): JsonObject {
  const properties = definitionFor(actionType).parameterSchema.properties;
  assert.ok(properties && typeof properties === "object" && !Array.isArray(properties), `${actionType} declares no properties`);
  return properties as JsonObject;
}

function requiredOf(actionType: WebAutomationActionType): string[] {
  const required = definitionFor(actionType).parameterSchema.required;
  return Array.isArray(required) ? required.filter((key): key is string => typeof key === "string") : [];
}

function objectAt(properties: JsonObject, key: string): JsonObject {
  const value = properties[key];
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${key} is not an object schema`);
  return value as JsonObject;
}

test("every action type has exactly one definition, and no definition is orphaned", () => {
  assert.deepEqual(
    webAutomationActionDefinitions.map((definition) => definition.actionType).sort(),
    [...WEB_AUTOMATION_ACTION_TYPES].sort()
  );
  for (const definition of webAutomationActionDefinitions) {
    assert.equal(definition.label.trim().length > 0, true, `${definition.actionType} needs a label`);
    assert.equal(definition.description.trim().length > 0, true, `${definition.actionType} needs a description`);
    assert.equal(definition.parameterSchema.type, "object", `${definition.actionType} parameters must be an object`);
  }
});

test("an element fingerprint carries Core's identity signals", () => {
  // testId, accessibleName and label are three of the highest-weighted signals
  // in Core's element matcher; a target without them can only match on its
  // selector and text.
  const element = objectAt(propertiesOf("web.dom.click"), "element");
  const properties = element.properties as JsonObject;
  for (const signal of ["testId", "accessibleName", "label", "selector", "xpath", "role", "attributes"]) {
    assert.ok(properties[signal], `the element fingerprint is missing ${signal}`);
  }
});

test("web.dom.check names the state to leave the control in", () => {
  const properties = propertiesOf("web.dom.check");
  assert.deepEqual(requiredOf("web.dom.check"), ["selector"]);
  assert.equal((properties.checked as JsonObject).type, "boolean");
  assert.ok(properties.selector && properties.element && properties.visualTarget);
});

test("web.dom.assert carries the condition, its expectation, and a timeout", () => {
  assert.deepEqual(requiredOf("web.dom.assert"), ["assert"]);
  const assertion = objectAt(propertiesOf("web.dom.assert"), "assert");
  assert.deepEqual(assertion.required, ["kind"]);
  const properties = assertion.properties as JsonObject;
  assert.deepEqual((properties.kind as JsonObject).enum, ["exists", "absent", "text", "url", "visible", "enabled"]);
  assert.equal((properties.expected as JsonObject).type, "string");
  assert.equal((properties.timeoutMs as JsonObject).type, "integer");
});

test("web.dom.extract_list mirrors the scenario contract's extract step and bounds its pagination", () => {
  assert.deepEqual(requiredOf("web.dom.extract_list"), ["extractList"]);
  const request = objectAt(propertiesOf("web.dom.extract_list"), "extractList");
  assert.deepEqual(request.required, ["item", "fields"]);
  const properties = request.properties as JsonObject;
  assert.equal((properties.item as JsonObject).type, "string");
  assert.equal((properties.fields as JsonObject).type, "object");
  assert.equal((properties.maxItems as JsonObject).type, "integer");
  const paginate = properties.paginate as JsonObject;
  assert.deepEqual(paginate.required, ["next", "maxPages"]);
  // The bound is the domain's, so no Flow can follow pages without end.
  assert.equal(((paginate.properties as JsonObject).maxPages as JsonObject).maximum, WEB_AUTOMATION_EXTRACT_MAX_PAGES);
});

test("web.dom.upload carries each file's name, type, and content", () => {
  assert.deepEqual(requiredOf("web.dom.upload"), ["selector", "upload"]);
  const upload = objectAt(propertiesOf("web.dom.upload"), "upload");
  assert.deepEqual(upload.required, ["files"]);
  const files = (upload.properties as JsonObject).files as JsonObject;
  assert.equal(files.type, "array");
  assert.deepEqual((files.items as JsonObject).required, ["name", "mimeType", "contentBase64"]);
});

test("web.dom.dialog arms one of the two answers a native dialog accepts", () => {
  assert.deepEqual(requiredOf("web.dom.dialog"), ["dialog"]);
  const dialog = objectAt(propertiesOf("web.dom.dialog"), "dialog");
  assert.deepEqual(dialog.required, ["response"]);
  const properties = dialog.properties as JsonObject;
  assert.deepEqual((properties.response as JsonObject).enum, ["accept", "dismiss"]);
  assert.equal((properties.promptText as JsonObject).type, "string");
});

test("web.browser.tab names the operation and how the tab is identified", () => {
  assert.deepEqual(requiredOf("web.browser.tab"), ["tab"]);
  const tab = objectAt(propertiesOf("web.browser.tab"), "tab");
  assert.deepEqual(tab.required, ["operation"]);
  const properties = tab.properties as JsonObject;
  assert.deepEqual((properties.operation as JsonObject).enum, ["open", "switch", "close"]);
  for (const key of ["url", "active", "tabId", "urlPattern"]) assert.ok(properties[key], `tab is missing ${key}`);
});

test("web.browser.download waits for a named file or the next one", () => {
  assert.deepEqual(requiredOf("web.browser.download"), []);
  const download = objectAt(propertiesOf("web.browser.download"), "download");
  const properties = download.properties as JsonObject;
  assert.equal((properties.filename as JsonObject).type, "string");
  assert.equal((properties.timeoutMs as JsonObject).type, "integer");
});

test("the original eleven gained the parameters D6 added to them", () => {
  assert.equal((propertiesOf("web.browser.navigate").newTab as JsonObject).type, "boolean");
  const option = objectAt(propertiesOf("web.dom.select"), "option");
  assert.deepEqual(((option.properties as JsonObject).by as JsonObject).enum, ["value", "label", "index"]);
  const scroll = objectAt(propertiesOf("web.dom.scroll"), "scroll");
  assert.deepEqual(((scroll.properties as JsonObject).mode as JsonObject).enum, ["by", "toElement", "untilStable"]);
  assert.ok((scroll.properties as JsonObject).maxScrolls, "untilStable needs a scroll bound");
  // A scroll to an element needs a target, so the scroll action gained one.
  assert.ok(propertiesOf("web.dom.scroll").selector);
  const modifiers = objectAt(propertiesOf("web.dom.keypress"), "modifiers");
  for (const key of ["alt", "ctrl", "meta", "shift"]) assert.ok((modifiers.properties as JsonObject)[key], `modifiers is missing ${key}`);
  for (const waiting of ["web.dom.wait_for_selector", "web.dom.wait_for_text"] as const) {
    const wait = objectAt(propertiesOf(waiting), "wait");
    assert.deepEqual(
      ((wait.properties as JsonObject).condition as JsonObject).enum,
      ["present", "visible", "enabled", "absent", "url", "stable"],
      `${waiting} must offer every wait condition`
    );
  }
});
