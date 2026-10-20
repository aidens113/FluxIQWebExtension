// The one sensitivity rule, pinned in both directions: what it must catch, and
// what it must leave alone. A rule that redacted everything would satisfy every
// leak test in the repository and destroy the recording, so the negative rows
// carry as much weight as the positive ones.
//
// The positive rows are the union of what the four copies caught before they
// were collapsed. Any row here that was already true of one copy but not of
// another is a leak that copy had; they are marked.
//
// No real secret appears here. Every value is a field signature, never a value.

import assert from "node:assert/strict";
import test from "node:test";
import { isSensitiveFieldSignature } from "../signature";

test("a password control is sensitive by either type field, in any case", () => {
  assert.equal(isSensitiveFieldSignature({ inputType: "password" }), true);
  assert.equal(isSensitiveFieldSignature({ inputType: "PASSWORD" }), true);
  assert.equal(isSensitiveFieldSignature({ inputType: " password " }), true);
  // `controlType` is the raw `type` attribute, which is all a serialized
  // descriptor has when `inputType` was not derived.
  assert.equal(isSensitiveFieldSignature({ controlType: "password" }), true);
});

test("the two control types reusable evidence tested for are still sensitive", () => {
  // Neither is a real HTML input type, but `reusable-evidence.ts` tested for
  // both before the rules were collapsed. Dropping them would have made that
  // call site less strict than it was.
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
    "  CC-NAME  ",
  ]) {
    assert.equal(isSensitiveFieldSignature({ autocomplete }), true, autocomplete);
  }
});

test("the autocomplete attribute is read in full, never cut to a display bound", () => {
  // The packet's copy bounded the attribute to 200 characters before testing
  // it, so a card token pushed past the cut was not sensitive. Truncating the
  // input to a security predicate is a way past it.
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
  for (const autocomplete of [undefined, "", "email", "billing street-address", "name", "off", "cc"]) {
    assert.equal(isSensitiveFieldSignature({ inputType: "text", autocomplete }), false, String(autocomplete));
  }
  assert.equal(isSensitiveFieldSignature({ dataSensitive: "false" }), false);
  assert.equal(isSensitiveFieldSignature({}), false);
});

test("a card security code is sensitive by its name, its id or its label on a text-entry input", () => {
  // bigbox-retail's card frame: `<input name="cvc" inputmode="numeric">`,
  // labelled "Security code", no `autocomplete`. Its typed value reached the
  // snapshot, every keydown and the recorded `dom.input` (t730 c2) while the
  // rule read only type, autocomplete and data-sensitive.
  assert.equal(isSensitiveFieldSignature({ inputType: "text", names: ["cvc"] }), true);
  assert.equal(isSensitiveFieldSignature({ inputType: "text", names: [undefined, "card-cvv"] }), true);
  assert.equal(isSensitiveFieldSignature({ inputType: "text", labels: ["Security code"] }), true);
  assert.equal(isSensitiveFieldSignature({ inputType: "tel", labels: [undefined, "", "CVC"] }), true);
  assert.equal(isSensitiveFieldSignature({ inputType: "number", names: ["securityCode"] }), true);
  // A serialized descriptor's raw `type` attribute, absent for an input that never wrote one.
  assert.equal(isSensitiveFieldSignature({ controlType: "", names: ["cvc"] }), true);
  assert.equal(isSensitiveFieldSignature({ controlType: "TEXT", labels: ["Card verification value"] }), true);
});

test("a security-code name does not mark what is not a text-entry input", () => {
  // A button that says "Security code", a checkbox named for one, or a control
  // whose type nobody reported holds no typed code to withhold.
  for (const type of ["button", "submit", "checkbox", "radio", "hidden", "file"]) {
    assert.equal(isSensitiveFieldSignature({ inputType: type, names: ["cvc"], labels: ["Security code"] }), false, type);
  }
  assert.equal(isSensitiveFieldSignature({ names: ["cvc"], labels: ["Security code"] }), false);
});

test("ordinary names and labels leave a text input ordinary", () => {
  assert.equal(isSensitiveFieldSignature({ inputType: "text", names: ["zip", "postal_code"], labels: ["ZIP code"] }), false);
  assert.equal(isSensitiveFieldSignature({ inputType: "text", names: ["promo"], labels: ["Promo code", "Gift card code"] }), false);
  assert.equal(isSensitiveFieldSignature({ inputType: "text", names: [], labels: [] }), false);
});

test("hidden and file controls are not sensitive, deliberately", () => {
  // `reusable-evidence.ts` keeps them out of a reusable fingerprint, and asks
  // its own separately named question to do so. Folding them in here would
  // start withholding values the recorder is supposed to capture -- a file
  // input's filename is what an upload step replays.
  for (const type of ["hidden", "file"]) {
    assert.equal(isSensitiveFieldSignature({ inputType: type }), false, type);
  }
});
