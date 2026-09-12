// src/sensitivity/tests/signature.test.ts
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

// src/sensitivity/tests/signature.test.ts
test("a password control is sensitive by either type field, in any case", () => {
  assert.equal(isSensitiveFieldSignature({ inputType: "password" }), true);
  assert.equal(isSensitiveFieldSignature({ inputType: "PASSWORD" }), true);
  assert.equal(isSensitiveFieldSignature({ inputType: " password " }), true);
  assert.equal(isSensitiveFieldSignature({ controlType: "password" }), true);
});
test("the two control types reusable evidence tested for are still sensitive", () => {
  for (const type of ["one-time-code", "credit-card"]) {
    assert.equal(isSensitiveFieldSignature({ inputType: type }), true, type);
    assert.equal(isSensitiveFieldSignature({ controlType: type }), true, type);
  }
});
test("every autocomplete token is checked, not only the whole attribute", () => {
  for (const autocomplete of [
    "cc-number",
    // The multi-token forms. The LLM evidence packet's copy compared the whole
    // attribute, so every one of these was invisible to it -- and `billing
    // cc-number` is what a real card field carries.
    "billing cc-number",
    "shipping cc-exp",
    "section-pay billing cc-csc",
    "current-password",
    "username new-password",
    "one-time-code",
    "  CC-NAME  "
  ]) {
    assert.equal(isSensitiveFieldSignature({ autocomplete }), true, autocomplete);
  }
});
test("the autocomplete attribute is read in full, never cut to a display bound", () => {
  const padded = `${"section-x ".repeat(60)}billing cc-number`;
  assert.ok(padded.length > 200);
  assert.equal(isSensitiveFieldSignature({ autocomplete: padded }), true);
});
test("data-sensitive marks a control whatever its type", () => {
  assert.equal(isSensitiveFieldSignature({ inputType: "text", dataSensitive: "true" }), true);
  assert.equal(isSensitiveFieldSignature({ dataSensitive: "TRUE" }), true);
  assert.equal(isSensitiveFieldSignature({ dataSensitive: " true " }), true);
});
test("ordinary fields are not sensitive", () => {
  for (const autocomplete of [void 0, "", "email", "billing street-address", "name", "off", "cc"]) {
    assert.equal(isSensitiveFieldSignature({ inputType: "text", autocomplete }), false, String(autocomplete));
  }
  assert.equal(isSensitiveFieldSignature({ dataSensitive: "false" }), false);
  assert.equal(isSensitiveFieldSignature({}), false);
});
test("hidden and file controls are not sensitive, deliberately", () => {
  for (const type of ["hidden", "file"]) {
    assert.equal(isSensitiveFieldSignature({ inputType: type }), false, type);
  }
});
