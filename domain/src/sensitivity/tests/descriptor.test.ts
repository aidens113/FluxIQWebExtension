// Reading the rule's three signals off a serialized element descriptor. The
// descriptor arrives from a page, so every row that matters here is a shape
// the sanitizer must survive rather than a shape it expects.

import assert from "node:assert/strict";
import test from "node:test";
import { isSensitiveElementDescriptor, sensitiveFieldSignatureOfDescriptor } from "../descriptor";

test("the three signals are read from where the wire descriptor puts them", () => {
  assert.deepEqual(
    sensitiveFieldSignatureOfDescriptor({
      tagName: "input",
      inputType: "text",
      attributes: { type: "text", autocomplete: "billing cc-number", "data-sensitive": "false" }
    }),
    { inputType: "text", controlType: "text", autocomplete: "billing cc-number", dataSensitive: "false", names: [], labels: [] }
  );
});

test("the names and labels are read from where the wire descriptor puts them", () => {
  assert.deepEqual(
    sensitiveFieldSignatureOfDescriptor({
      tagName: "input",
      inputType: "text",
      id: "pay-cvc",
      label: "Security code",
      accessibleName: "Security code",
      attributes: { name: "cvc", id: "pay-cvc", "aria-label": "CVC", placeholder: "123" }
    }),
    {
      inputType: "text",
      controlType: undefined,
      autocomplete: undefined,
      dataSensitive: undefined,
      names: ["cvc", "pay-cvc", "pay-cvc"],
      labels: ["Security code", "Security code", "CVC", "123"]
    }
  );
});

test("a card security code's descriptor is sensitive without autocomplete", () => {
  // The wire shape of bigbox-retail's card frame field (t730 c2): a name and a label, nothing else.
  assert.equal(isSensitiveElementDescriptor({ tagName: "input", inputType: "text", attributes: { name: "cvc", inputmode: "numeric" } }), true);
  assert.equal(isSensitiveElementDescriptor({ tagName: "input", inputType: "text", label: "Security code", attributes: { name: "field-7" } }), true);
  assert.equal(isSensitiveElementDescriptor({ tagName: "input", inputType: "text", accessibleName: "CVV" }), true);
  // A label is page text and arrives as anything; only a string is read.
  assert.equal(isSensitiveElementDescriptor({ tagName: "input", inputType: "text", label: ["Security code"], attributes: { name: 7 } }), false);
  assert.equal(isSensitiveElementDescriptor({ tagName: "button", text: "Security code", attributes: { name: "cvc" } }), false);
  assert.equal(isSensitiveElementDescriptor({ tagName: "input", inputType: "text", label: "ZIP code", attributes: { name: "zip" } }), false);
});

test("a descriptor naming a secret-bearing control is sensitive", () => {
  assert.equal(isSensitiveElementDescriptor({ inputType: "password" }), true);
  assert.equal(isSensitiveElementDescriptor({ attributes: { type: "password" } }), true);
  assert.equal(isSensitiveElementDescriptor({ attributes: { autocomplete: "billing cc-number" } }), true);
  assert.equal(isSensitiveElementDescriptor({ attributes: { "data-sensitive": "true" } }), true);
  // A select can be marked too; the option list is its value space.
  assert.equal(isSensitiveElementDescriptor({ tagName: "select", attributes: { "data-sensitive": "true" } }), true);
});

test("an ordinary descriptor is not sensitive", () => {
  assert.equal(isSensitiveElementDescriptor({ tagName: "input", inputType: "email", attributes: { autocomplete: "email" } }), false);
  assert.equal(isSensitiveElementDescriptor({ tagName: "a", attributes: { href: "/next" } }), false);
});

test("a malformed descriptor is not a control and does not throw", () => {
  for (const input of [undefined, null, "password", 7, [], [{ inputType: "password" }], { attributes: "password" }, { attributes: null }, { inputType: 7 }]) {
    assert.equal(isSensitiveElementDescriptor(input), false, JSON.stringify(input) ?? String(input));
  }
});

test("a non-string attribute cannot pass the data-sensitive test", () => {
  // The page controls these values. `true` the boolean is not `"true"` the
  // attribute, and neither is an object with a lying `toString`.
  assert.equal(isSensitiveElementDescriptor({ attributes: { "data-sensitive": true } }), false);
  assert.equal(isSensitiveElementDescriptor({ attributes: { autocomplete: ["cc-number"] } }), false);
});

test("a descriptor the content side marks sensitive is sensitive, the marker alone and only when true", () => {
  // A field sensitive only through its marked group (t733 u2): nothing on the descriptor's own attributes says so.
  assert.equal(isSensitiveElementDescriptor({ tagName: "input", inputType: "text", sensitive: true, attributes: { name: "note" } }), true);
  assert.equal(sensitiveFieldSignatureOfDescriptor({ tagName: "input", sensitive: true }).dataSensitive, "true");
  // Only the literal `true` the producer writes counts; anything else a page sent is not read.
  assert.equal(isSensitiveElementDescriptor({ tagName: "input", inputType: "text", sensitive: "true" }), false);
  assert.equal(isSensitiveElementDescriptor({ tagName: "input", inputType: "text", sensitive: false }), false);
});
