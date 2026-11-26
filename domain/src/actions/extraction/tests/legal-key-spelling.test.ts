import assert from "node:assert/strict";
import test from "node:test";
import { isWebAutomationExtractFieldKey, webAutomationExtractFieldKeySpelling } from "../index";

test("a key with spaces or other characters a key may not hold is offered as its legal spelling", () => {
  assert.equal(webAutomationExtractFieldKeySpelling("group heading"), "group_heading");
  assert.equal(webAutomationExtractFieldKeySpelling("  unit price (net) "), "unit_price_net");
  assert.equal(webAutomationExtractFieldKeySpelling("a--b c"), "a--b_c");
  assert.equal(webAutomationExtractFieldKeySpelling("x".repeat(150))?.length, 100);
});

test("a key nothing of which survives, or that is a prototype name, has no spelling; a legal key is its own", () => {
  assert.equal(webAutomationExtractFieldKeySpelling("   "), undefined);
  assert.equal(webAutomationExtractFieldKeySpelling("(*)"), undefined);
  assert.equal(webAutomationExtractFieldKeySpelling("constructor"), undefined);
  assert.equal(webAutomationExtractFieldKeySpelling("price_2"), "price_2");
  for (const key of ["group heading", "über", "a.b"]) assert.equal(isWebAutomationExtractFieldKey(webAutomationExtractFieldKeySpelling(key)), true);
});
