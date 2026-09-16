// The item signature the page groups a repeating run by, pinned exactly as
// `content/evidence/repeating.ts` built it before this pure half moved here.
// The evidence and the picker must group siblings identically, so the expected
// strings below are the literal ones that code produced.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationIdentifierShape, webAutomationItemSignature } from "../signature";

test("numbered test ids share one shape", () => {
  assert.equal(webAutomationIdentifierShape("row-1"), "row-#");
  assert.equal(webAutomationIdentifierShape("row-2"), webAutomationIdentifierShape("row-1"));
  // A run of digits is one number, so a tenth row is the same template as a first.
  assert.equal(webAutomationIdentifierShape("row-12"), webAutomationIdentifierShape("row-1"));
  assert.equal(webAutomationIdentifierShape("pagination-page-1"), "pagination-page-#");
  assert.equal(webAutomationIdentifierShape("row-3-cell-27"), "row-#-cell-#");
  assert.equal(webAutomationIdentifierShape("product-card"), "product-card");
});

test("an absent test id has an empty shape, and an empty one stays empty", () => {
  assert.equal(webAutomationIdentifierShape(undefined), "");
  assert.equal(webAutomationIdentifierShape(""), "");
});

test("a signature is tag, role, test-id shape and classes, in that order", () => {
  assert.equal(
    webAutomationItemSignature({ tagName: "LI", role: "option", testId: "row-7", classes: ["card"] }),
    "li|option|row-#|card"
  );
  assert.equal(webAutomationItemSignature({ tagName: "TR", classes: [] }), "tr|||");
  assert.equal(webAutomationItemSignature({ tagName: "article", role: null, testId: undefined, classes: [] }), "article|||");
});

test("the role is trimmed and lower-cased, and the tag lower-cased", () => {
  assert.equal(webAutomationItemSignature({ tagName: "DIV", role: "  ListItem ", classes: [] }), "div|listitem||");
});

test("classes are sorted and capped at 3", () => {
  assert.equal(webAutomationItemSignature({ tagName: "li", classes: ["delta", "beta", "alpha", "gamma"] }), "li|||alpha.beta.delta");
  assert.equal(webAutomationItemSignature({ tagName: "li", classes: ["c", "b"] }), "li|||b.c");
  // Order on the element does not change the template.
  assert.equal(
    webAutomationItemSignature({ tagName: "li", classes: ["gamma", "alpha", "beta"] }),
    webAutomationItemSignature({ tagName: "li", classes: ["beta", "gamma", "alpha"] })
  );
});

test("any iterable of classes signs, as an element's class list does", () => {
  assert.equal(webAutomationItemSignature({ tagName: "li", classes: new Set(["b", "a"]) }), "li|||a.b");
});

test("rows of one numbered template sign alike, and a different template does not", () => {
  const row = (testId: string, classes: string[]) => webAutomationItemSignature({ tagName: "TR", role: "row", testId, classes });
  assert.equal(row("order-row-1", ["row", "striped"]), row("order-row-12", ["striped", "row"]));
  assert.notEqual(row("order-row-1", ["row"]), row("order-row-1", ["row", "selected"]));
  assert.notEqual(row("order-row-1", ["row"]), row("summary-row", ["row"]));
});
