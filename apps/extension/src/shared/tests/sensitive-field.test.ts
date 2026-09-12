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

// Every row above is unchanged from before the rule moved into the domain
// package, and its passing is the proof that the move changed nothing the
// extension could observe. The rows below are what the shared rule adds.

test("the raw type attribute is read too, for a caller that has no derived input type", () => {
  assert.equal(isSensitiveFieldSignature({ controlType: "password" }), true);
  assert.equal(isSensitiveFieldSignature({ controlType: "email" }), false);
});

test("hidden and file controls stay ordinary on the extension side", () => {
  // Reusable evidence keeps them out of its fingerprint by asking its own
  // question. If they ever became sensitive here, an upload step would stop
  // being able to replay the file it recorded.
  assert.equal(isSensitiveFieldSignature({ inputType: "hidden" }), false);
  assert.equal(isSensitiveFieldSignature({ inputType: "file" }), false);
});
