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
    { inputType: "text", controlType: "text", autocomplete: "billing cc-number", dataSensitive: "false" }
  );
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
