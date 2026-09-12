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

test("hidden and file controls are not sensitive, deliberately", () => {
  // `reusable-evidence.ts` keeps them out of a reusable fingerprint, and asks
  // its own separately named question to do so. Folding them in here would
  // start withholding values the recorder is supposed to capture -- a file
  // input's filename is what an upload step replays.
  for (const type of ["hidden", "file"]) {
    assert.equal(isSensitiveFieldSignature({ inputType: type }), false, type);
  }
});
