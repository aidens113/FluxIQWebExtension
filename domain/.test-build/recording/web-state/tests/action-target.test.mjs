// src/recording/web-state/tests/action-target.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeAutomationStudioElementTarget } from "fluxiq/automation-studio";

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

// src/recording/web-state/compact-json-object.ts
function compactJsonObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0));
}

// src/recording/web-state/element/identity.ts
function meaningfulText(value) {
  return typeof value === "string" && value.trim().length >= 2;
}
function stableAttribute(element, name) {
  const value = element.attributes?.[name];
  return meaningfulText(value) ? value : void 0;
}

// src/recording/web-state/geometry.ts
function stateBounds(bounds) {
  if (!bounds) return void 0;
  const x = finite(bounds.x);
  const y = finite(bounds.y);
  const width = positiveFinite(bounds.width);
  const height = positiveFinite(bounds.height);
  return x !== void 0 && y !== void 0 && width !== void 0 && height !== void 0 ? { x, y, width, height } : void 0;
}
function positiveFinite(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : void 0;
}
function finite(value) {
  return Number.isFinite(value) ? value : void 0;
}

// src/recording/web-state/action-target.ts
function webAutomationActionTargetFromElement(element) {
  const secret = isSensitiveElementDescriptor(element);
  const visibleText = secret ? void 0 : element.visibleText;
  const text = secret ? void 0 : element.text;
  const value = secret ? void 0 : element.value;
  return compactJsonObject({
    type: element.role ?? element.inputType ?? element.tagName,
    id: stableAttribute(element, "data-testid") ?? stableAttribute(element, "id") ?? stableAttribute(element, "name"),
    label: element.name ?? visibleText ?? text ?? value,
    selector: element.selector,
    bounds: element.bounds,
    // Neither is this producer's to fill: a relative position belongs to a
    // click that carried one, and both `visualTarget` and `elementTarget` are
    // written by the callers that have them
    // (`client/gateway-mapping.ts`, and Core's own dispatch preparation).
    relativePosition: void 0,
    visualTarget: void 0,
    elementTarget: void 0,
    metadata: compactJsonObject({
      tagName: element.tagName,
      xpath: element.xpath,
      id: element.id,
      classNames: element.classNames,
      visibleText,
      role: element.role,
      href: element.href,
      inputType: element.inputType,
      documentBounds: stateBounds(element.documentBounds),
      isVisibleOnViewport: element.isVisibleOnViewport ?? Boolean(stateBounds(element.bounds)),
      hasClickHandler: element.hasClickHandler,
      attributes: element.attributes,
      testId: element.testId,
      accessibleName: secret ? void 0 : element.accessibleName,
      label: element.label,
      implicitRole: element.implicitRole,
      context: element.context
    })
  });
}

// src/recording/web-state/tests/action-target.test.ts
var TARGET_METADATA_FIELDS = [
  "tagName",
  "xpath",
  "id",
  "classNames",
  "visibleText",
  "role",
  "href",
  "inputType",
  "documentBounds",
  "isVisibleOnViewport",
  "hasClickHandler",
  "attributes",
  "testId",
  "accessibleName",
  "label",
  "implicitRole",
  "context"
];
var IDENTITY_SIGNALS = ["testId", "accessibleName", "label", "implicitRole", "context"];
var fullyDescribed = {
  tagName: "button",
  selector: "#save-settings",
  xpath: "/html/body/main/form/div/button",
  id: "save-settings",
  classNames: ["btn", "btn-primary"],
  visibleText: "Save changes",
  text: "Save changes",
  value: "save",
  role: "button",
  name: "Save changes",
  href: "https://example.test/save",
  inputType: "submit",
  bounds: { x: 1, y: 2, width: 3, height: 4 },
  documentBounds: { x: 1, y: 6, width: 3, height: 4 },
  isVisibleOnViewport: true,
  hasClickHandler: true,
  attributes: { id: "save-settings", class: "btn btn-primary", "data-testid": "save-changes" },
  testId: "save-changes",
  accessibleName: "Save changes",
  label: "Workspace name",
  implicitRole: "button",
  context: { formId: "settings-form", formName: "settings", fieldsetLegend: "General", heading: "Workspace settings" }
};
function metadataOf(element) {
  const metadata = webAutomationActionTargetFromElement(element).metadata;
  assert.ok(metadata && typeof metadata === "object" && !Array.isArray(metadata), "the target carries metadata");
  return metadata;
}
test("the envelope target's metadata carries every field the contract declares, and only those", () => {
  assert.deepEqual(Object.keys(metadataOf(fullyDescribed)).sort(), [...TARGET_METADATA_FIELDS].sort());
});
test("every identity signal reaches the envelope target with the value the recorder captured", () => {
  const metadata = metadataOf(fullyDescribed);
  for (const signal of IDENTITY_SIGNALS) {
    assert.deepEqual(metadata[signal], fullyDescribed[signal], `${signal} reaches the envelope target`);
  }
});
test("Core's element-target normalizer reads the identity signals off the metadata", () => {
  const target = webAutomationActionTargetFromElement(fullyDescribed);
  const normalized = normalizeAutomationStudioElementTarget(target, { source: "recording" });
  assert.ok(normalized, "the envelope target normalizes to an element target");
  assert.equal(normalized.fingerprint.testId, "save-changes");
  assert.equal(normalized.fingerprint.accessibleName, "Save changes");
  assert.equal(normalized.fingerprint.role, "button");
  assert.equal(normalized.fingerprint.visibleText, "Save changes");
  assert.equal(normalized.fingerprint.xpath, "/html/body/main/form/div/button");
  assert.deepEqual(normalized.fingerprint.classNames, ["btn", "btn-primary"]);
  assert.equal(normalized.fingerprint.metadata?.implicitRole, "button");
  assert.deepEqual(normalized.fingerprint.metadata?.context, fullyDescribed.context);
  assert.equal(normalized.fingerprint.label, "Save changes");
  assert.equal(normalized.fingerprint.metadata?.label, void 0);
});
test("the promoted fields stay where ActionTarget declares them, and the target is unchanged otherwise", () => {
  const target = webAutomationActionTargetFromElement(fullyDescribed);
  assert.equal(target.type, "button");
  assert.equal(target.id, "save-changes");
  assert.equal(target.label, "Save changes");
  assert.equal(target.selector, "#save-settings");
  assert.deepEqual(target.bounds, { x: 1, y: 2, width: 3, height: 4 });
  assert.equal("relativePosition" in target, false, "an absent optional field is absent, not null");
  assert.equal("visualTarget" in target, false);
  assert.equal("elementTarget" in target, false);
});
test("an element the page said little about gains no empty fields", () => {
  const target = webAutomationActionTargetFromElement({ tagName: "div", selector: "#plain" });
  assert.deepEqual(target, { type: "div", selector: "#plain", metadata: { tagName: "div", isVisibleOnViewport: false } });
});
test("a sensitive control sends no contents, and keeps the identity the author wrote", () => {
  const secret = "hunter2-should-never-cross";
  const password = {
    tagName: "input",
    selector: "#password",
    id: "password",
    inputType: "password",
    value: secret,
    visibleText: secret,
    text: secret,
    accessibleName: secret,
    label: "Password",
    implicitRole: "textbox",
    testId: "password-field",
    context: { formName: "sign-in" },
    attributes: { id: "password", type: "password", autocomplete: "current-password" }
  };
  const target = webAutomationActionTargetFromElement(password);
  assert.equal(JSON.stringify(target).includes(secret), false, "no field carries the control's contents");
  assert.equal("label" in target, false);
  const metadata = target.metadata;
  for (const field of ["visibleText", "accessibleName"]) {
    assert.equal(field in metadata, false, `${field} is withheld on a sensitive control`);
  }
  assert.equal(metadata.label, "Password");
  assert.deepEqual(metadata.context, { formName: "sign-in" });
  assert.equal(metadata.testId, "password-field");
  assert.equal(metadata.implicitRole, "textbox");
});
