import assert from "node:assert/strict";
import test from "node:test";
import { isSensitiveFieldSignature } from "../sensitive-field";

test("password inputs and fields marked data-sensitive are sensitive", () => {
  assert.equal(isSensitiveFieldSignature({ inputType: "password" }), true);
  assert.equal(isSensitiveFieldSignature({ inputType: "PASSWORD" }), true);
  assert.equal(isSensitiveFieldSignature({ inputType: "text", dataSensitive: "true" }), true);
});

test("every autocomplete token is checked, not only the whole value", () => {
  for (const autocomplete of [
    "cc-number",
    "billing cc-number",
    "shipping cc-exp",
    "section-pay billing cc-csc",
    "current-password",
    "username new-password",
    "one-time-code",
    "  CC-NAME  ",
  ]) {
    assert.equal(isSensitiveFieldSignature({ autocomplete }), true, autocomplete);
  }
});

test("ordinary fields are not sensitive", () => {
  for (const autocomplete of [undefined, "", "email", "billing street-address", "name", "off"]) {
    assert.equal(isSensitiveFieldSignature({ inputType: "text", autocomplete }), false, String(autocomplete));
  }
  assert.equal(isSensitiveFieldSignature({ dataSensitive: "false" }), false);
});
