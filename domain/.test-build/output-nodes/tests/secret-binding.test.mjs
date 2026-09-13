// src/output-nodes/tests/secret-binding.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { resolveAutomationNodeParameterValues } from "fluxiq/automation-studio/nodes";

// src/sensitivity/signature.ts
var SENSITIVE_CONTROL_TYPES = /* @__PURE__ */ new Set(["password", "one-time-code", "credit-card"]);
var SENSITIVE_AUTOCOMPLETE_TOKENS = /* @__PURE__ */ new Set(["current-password", "new-password", "one-time-code"]);
var SENSITIVE_AUTOCOMPLETE_PREFIX = "cc-";
function isSensitiveFieldSignature(signature) {
  if (isSensitiveControlType(signature.inputType) || isSensitiveControlType(signature.controlType)) return true;
  if (signature.dataSensitive?.trim().toLowerCase() === "true") return true;
  return (signature.autocomplete ?? "").toLowerCase().split(/\s+/u).some((token) => Boolean(token) && (SENSITIVE_AUTOCOMPLETE_TOKENS.has(token) || token.startsWith(SENSITIVE_AUTOCOMPLETE_PREFIX)));
}
function isSensitiveControlType(type) {
  return type !== void 0 && SENSITIVE_CONTROL_TYPES.has(type.trim().toLowerCase());
}

// src/sensitivity/descriptor.ts
function sensitiveFieldSignatureOfDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== "object" || Array.isArray(descriptor)) return {};
  const record = descriptor;
  const attributes = record.attributes && typeof record.attributes === "object" && !Array.isArray(record.attributes) ? record.attributes : {};
  return {
    inputType: stringField(record.inputType),
    controlType: stringField(attributes.type),
    autocomplete: stringField(attributes.autocomplete),
    dataSensitive: stringField(attributes["data-sensitive"])
  };
}
function isSensitiveElementDescriptor(descriptor) {
  return isSensitiveFieldSignature(sensitiveFieldSignatureOfDescriptor(descriptor));
}
function stringField(value) {
  return typeof value === "string" ? value : void 0;
}

// src/output-nodes/targets.ts
function elementFingerprint(value) {
  const element = objectValue(value);
  if (!element) return void 0;
  const attributes = elementAttributes(element.attributes);
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
    implicitRole: stringValue(element.implicitRole),
    name: stringValue(element.name),
    href: stringValue(element.href),
    inputType: stringValue(element.inputType),
    testId: elementTestId(element, attributes),
    accessibleName: stringValue(element.accessibleName) ?? stringValue(attributes?.["aria-label"]),
    label: stringValue(element.label),
    attributes,
    context: elementContext(element.context),
    // Core's remaining fingerprint signals, named so their absence is a
    // decision and so a signal Core adds stops this producer compiling. A
    // browser recording has no source for any of them: the first four are a
    // host application's own identifiers and a Core state path, `url` names
    // the page rather than the control, `bounds` are the capture's viewport
    // and not this instant's (which is why `content/identity/score.ts` refuses
    // to compare them), and `metadata` is Core's own passthrough slot, which
    // this normalizer must not start writing into behind the declared fields.
    automationId: void 0,
    entityId: void 0,
    entityKind: void 0,
    statePath: void 0,
    queryPath: void 0,
    url: void 0,
    bounds: void 0,
    metadata: void 0
  });
}
function elementContext(value) {
  const context = objectValue(value);
  if (!context) return void 0;
  const fields = compact({
    formId: stringValue(context.formId),
    formName: stringValue(context.formName),
    formAction: stringValue(context.formAction),
    fieldsetLegend: stringValue(context.fieldsetLegend),
    landmark: stringValue(context.landmark),
    heading: stringValue(context.heading),
    listPosition: listPosition(context.listPosition),
    tablePosition: tablePosition(context.tablePosition)
  });
  return Object.keys(fields).length > 0 ? fields : void 0;
}
function listPosition(value) {
  const position = objectValue(value);
  const index = numberValue(position?.index);
  const total = numberValue(position?.total);
  return index === void 0 || total === void 0 ? void 0 : { index, total };
}
function tablePosition(value) {
  const position = objectValue(value);
  const row = numberValue(position?.row);
  const column = numberValue(position?.column);
  if (row === void 0 || column === void 0) return void 0;
  const columnHeader = stringValue(position?.columnHeader);
  return columnHeader === void 0 ? { row, column } : { row, column, columnHeader };
}
function elementAttributes(value) {
  const attributes = objectValue(value);
  if (!attributes) return void 0;
  const strings = {};
  for (const [name, item] of Object.entries(attributes)) {
    if (typeof item === "string") strings[name] = item;
  }
  return strings;
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

// src/output-nodes/secret-binding.ts
var WEB_AUTOMATION_SECRET_STATE_PREFIX = "web.secret.";
function webAutomationSecretStatePath(key) {
  return `${WEB_AUTOMATION_SECRET_STATE_PREFIX}${key}`;
}
function webAutomationSecretBinding(key) {
  return { $state: { path: webAutomationSecretStatePath(key) } };
}
function webAutomationSecretBindingPath(value) {
  const path = stringValue(objectValue(objectValue(value)?.$state)?.path);
  return path?.startsWith(WEB_AUTOMATION_SECRET_STATE_PREFIX) ? path : void 0;
}
function webAutomationUnresolvedSecretParameters(parameters) {
  return Object.entries(parameters).flatMap(([parameter, value]) => {
    const path = webAutomationSecretBindingPath(value);
    return path === void 0 ? [] : [{ parameter, path }];
  });
}
function webAutomationSecretKeyForRecordedElement(payload) {
  const element = objectValue(payload.element);
  const attributes = objectValue(element?.attributes);
  const statePath = stringValue(objectValue(payload.visualTarget)?.statePath);
  const fromStatePath = statePath?.startsWith("web.elements.") ? statePath.slice("web.elements.".length) : void 0;
  const identity = fromStatePath ?? stringValue(element?.testId) ?? stringValue(attributes?.["data-testid"]) ?? stringValue(attributes?.["data-test"]) ?? stringValue(attributes?.["data-cy"]) ?? stringValue(element?.id) ?? stringValue(attributes?.id) ?? stringValue(element?.name) ?? stringValue(attributes?.name) ?? stringValue(element?.selector) ?? stringValue(payload.selector);
  const key = sanitizeSecretKey(identity ?? "");
  return key.length ? key : void 0;
}
function sanitizeSecretKey(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "").slice(0, 120);
}

// src/output-nodes/payloads.ts
function webAutomationOutputPayload(outputId, payload) {
  return withRecordedFrame(outputId, payload, recordedOutputParameters(outputId, payload));
}
function withRecordedFrame(outputId, payload, parameters) {
  const browserFrameId = frameIdValue(payload.browserFrameId);
  if (browserFrameId === void 0 || !outputId.startsWith("web.dom.")) return parameters;
  return Object.keys(parameters).length === 0 ? parameters : { ...parameters, browserFrameId };
}
function frameIdValue(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : void 0;
}
function recordedOutputParameters(outputId, payload) {
  const element = elementFingerprint(payload.element);
  const selector = stringValue(element?.selector);
  const visualTarget = objectValue(payload.visualTarget);
  const target = compact({ ...element ? { element } : {}, ...visualTarget ? { visualTarget } : {} });
  const hasTarget = Object.keys(target).length > 0;
  if (outputId === "web.browser.navigate") return compact({ url: stringValue(payload.url) });
  if (outputId === "web.dom.click" || outputId === "web.dom.clear") return compact({ selector, ...hasTarget ? target : {} });
  if (outputId === "web.dom.type") return compact({ selector, text: recordedTypedText(payload), ...hasTarget ? target : {} });
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
function recordedTypedText(payload) {
  const recorded = stringValue(payload.inputValue);
  if (recorded !== void 0) return recorded;
  if (!isSensitiveElementDescriptor(payload.element)) return "";
  const key = webAutomationSecretKeyForRecordedElement(payload);
  return key === void 0 ? "" : webAutomationSecretBinding(key);
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

// src/output-nodes/tests/secret-binding.test.ts
var withheldPasswordEntry = {
  element: {
    selector: '[data-testid="password"]',
    tagName: "input",
    inputType: "password",
    attributes: { "data-testid": "password", type: "password", autocomplete: "current-password" }
  },
  visualTarget: { namespace: "web", statePath: "web.elements.password", selector: '[data-testid="password"]' }
};
function parametersOf(payload) {
  return webAutomationOutputPayload("web.dom.type", payload);
}
test("a recorded entry whose value the recorder withheld asks for it, instead of replaying an empty string", () => {
  const parameters = parametersOf(withheldPasswordEntry);
  assert.notEqual(parameters.text, "", "an empty string is what typed nothing into a password field and reported success");
  assert.equal(
    webAutomationSecretBindingPath(parameters.text),
    webAutomationSecretStatePath("password"),
    "the request names the control, taken from the state path the node already carries"
  );
});
test("the request carries a path and nothing else -- no value, and no fallback to one", () => {
  const request = webAutomationSecretBinding("password");
  assert.deepEqual(Object.keys(request), ["$state"]);
  assert.deepEqual(Object.keys(request.$state), ["path"]);
  assert.equal("fallback" in request.$state, false);
});
test("a recorded value still replays as itself", () => {
  const parameters = parametersOf({ ...withheldPasswordEntry, inputValue: "typed-by-the-user" });
  assert.equal(parameters.text, "typed-by-the-user");
  assert.equal(webAutomationSecretBindingPath(parameters.text), void 0, "a literal is not a request");
});
test("only a request on the secret namespace is one", () => {
  assert.equal(webAutomationSecretStatePath("password").startsWith(WEB_AUTOMATION_SECRET_STATE_PREFIX), true);
  for (const value of ["password", "", 0, null, void 0, { $state: {} }, { $state: { path: "web.elements.password" } }]) {
    assert.equal(webAutomationSecretBindingPath(value), void 0, JSON.stringify(value) ?? "undefined");
  }
});
test("the key comes from identity the node already carries, richest first", () => {
  const key = (payload) => webAutomationSecretKeyForRecordedElement(payload);
  assert.equal(key(withheldPasswordEntry), "password");
  assert.equal(key({ ...withheldPasswordEntry, visualTarget: { statePath: "web.elements.password.2" } }), "password-2");
  assert.equal(key({ element: withheldPasswordEntry.element }), "password");
  assert.equal(key({ element: { selector: "form > input:nth-child(2)" } }), "form-input-nth-child-2");
  assert.equal(key({}), void 0);
});
test("a value supplied to the run reaches the dispatched parameters, and follows the run rather than any constant", () => {
  const parameters = parametersOf(withheldPasswordEntry);
  const path = webAutomationSecretStatePath("password");
  for (const supplied of ["run-one-sentinel", "run-two-sentinel"]) {
    const resolved = resolveAutomationNodeParameterValues(parameters, { [path]: supplied });
    assert.deepEqual(resolved.missingPaths, [], "a supplied secret leaves nothing missing");
    assert.equal(resolved.values.text, supplied);
    assert.equal(resolved.values.selector, parameters.selector, "the rest of the dispatch is untouched");
  }
});
test("with nothing supplied the node fails and names the path, rather than typing nothing", () => {
  const parameters = parametersOf(withheldPasswordEntry);
  const resolved = resolveAutomationNodeParameterValues(parameters, { "some.other.input": "unrelated" });
  assert.deepEqual(resolved.missingPaths, [webAutomationSecretStatePath("password")]);
  assert.equal("text" in resolved.values, false, "an unresolved request never degrades into a value");
});
test("an unmet request is findable by name and path, with no value to leak", () => {
  const parameters = parametersOf(withheldPasswordEntry);
  assert.deepEqual(webAutomationUnresolvedSecretParameters(parameters), [
    { parameter: "text", path: webAutomationSecretStatePath("password") }
  ]);
  const supplied = resolveAutomationNodeParameterValues(parameters, { [webAutomationSecretStatePath("password")]: "run-one-sentinel" });
  assert.deepEqual(webAutomationUnresolvedSecretParameters(supplied.values), [], "a met request is gone once Core resolves it");
});
test("no part of the request, resolved or not, is a value", () => {
  const serialized = JSON.stringify(parametersOf(withheldPasswordEntry));
  assert.equal(serialized.includes("run-one-sentinel"), false);
  assert.equal(serialized.includes(webAutomationSecretStatePath("password")), true);
});
