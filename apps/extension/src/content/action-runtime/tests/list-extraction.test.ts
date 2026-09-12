// T1 coverage of list extraction's field grammar and its page bound.
//
// `parseExtractField` is the half of the capability that needs no DOM, so it
// can run here; reading the fields from a live page, following pagination, and
// the records themselves are proven against real fixtures by
// `e2e/content/tests/extract-list.spec.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { WEB_AUTOMATION_EXTRACT_MAX_PAGES } from "@fluxiq-web-extension/domain/client";
import { EXTRACT_MAX_PAGES, parseExtractField } from "../list-extraction";

test("a plain selector reads the element's text", () => {
  assert.deepEqual(parseExtractField('[data-testid="product-name"]'), { kind: "element", selector: '[data-testid="product-name"]' });
});

test("an empty selector reads the item itself", () => {
  assert.deepEqual(parseExtractField(""), { kind: "element" });
});

test("a trailing @attribute reads that attribute instead of the text", () => {
  assert.deepEqual(parseExtractField('[data-testid="product-link"]@href'), {
    kind: "element",
    selector: '[data-testid="product-link"]',
    attribute: "href"
  });
});

test("the item's own attribute needs no selector", () => {
  assert.deepEqual(parseExtractField("@data-product-id"), { kind: "element", attribute: "data-product-id" });
});

test("an @ that is not an attribute name stays part of the selector", () => {
  assert.deepEqual(parseExtractField('[data-owner="a@b c"]'), { kind: "element", selector: '[data-owner="a@b c"]' });
});

test("column: names the header whose cell the field reads", () => {
  assert.deepEqual(parseExtractField("column:Price"), { kind: "column", header: "Price" });
  assert.deepEqual(parseExtractField("column:  Unit  price "), { kind: "column", header: "Unit price" });
});

test("a column field with no header is rejected rather than matching every column", () => {
  assert.throws(() => parseExtractField("column:   "), /names no column header/u);
});

test("the page bound agrees with the domain's, which the content script cannot import", () => {
  assert.equal(EXTRACT_MAX_PAGES, WEB_AUTOMATION_EXTRACT_MAX_PAGES);
});
