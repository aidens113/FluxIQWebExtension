// src/sensitivity/tests/descriptor.test.ts
import assert from "node:assert/strict";
import test from "node:test";

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

// src/sensitivity/tests/descriptor.test.ts
test("the three signals are read from where the wire descriptor puts them", () => {
  assert.deepEqual(
    sensitiveFieldSignatureOfDescriptor({
      tagName: "input",
      inputType: "text",
      attributes: { type: "text", autocomplete: "billing cc-number", "data-sensitive": "false" }
    }),
    { inputType: "text", controlType: "text", autocomplete: "billing cc-number", dataSensitive: "false" }
  );
});
test("a descriptor naming a secret-bearing control is sensitive", () => {
  assert.equal(isSensitiveElementDescriptor({ inputType: "password" }), true);
  assert.equal(isSensitiveElementDescriptor({ attributes: { type: "password" } }), true);
  assert.equal(isSensitiveElementDescriptor({ attributes: { autocomplete: "billing cc-number" } }), true);
  assert.equal(isSensitiveElementDescriptor({ attributes: { "data-sensitive": "true" } }), true);
  assert.equal(isSensitiveElementDescriptor({ tagName: "select", attributes: { "data-sensitive": "true" } }), true);
});
test("an ordinary descriptor is not sensitive", () => {
  assert.equal(isSensitiveElementDescriptor({ tagName: "input", inputType: "email", attributes: { autocomplete: "email" } }), false);
  assert.equal(isSensitiveElementDescriptor({ tagName: "a", attributes: { href: "/next" } }), false);
});
test("a malformed descriptor is not a control and does not throw", () => {
  for (const input of [void 0, null, "password", 7, [], [{ inputType: "password" }], { attributes: "password" }, { attributes: null }, { inputType: 7 }]) {
    assert.equal(isSensitiveElementDescriptor(input), false, JSON.stringify(input) ?? String(input));
  }
});
test("a non-string attribute cannot pass the data-sensitive test", () => {
  assert.equal(isSensitiveElementDescriptor({ attributes: { "data-sensitive": true } }), false);
  assert.equal(isSensitiveElementDescriptor({ attributes: { autocomplete: ["cc-number"] } }), false);
});
