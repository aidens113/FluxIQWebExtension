// T1 coverage of how an extract_list field becomes what the page reads: the
// string grammar, each structured spec kind, `required`, and the handling that
// is decided before the page is touched -- `exclude` dropping the field (D12)
// and `encrypt` refused as NOT_IMPLEMENTED.
//
// Normalizing needs no DOM, so it runs here. Reading the fields from a live
// page is proven against real fixtures by `e2e/content/tests/extract-list.spec.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationExtractListRequest } from "../../types";
import { normalizeExtractField } from "../field-spec";

type ExtractField = WebAutomationExtractListRequest["fields"][string];

/** Stands in for where a field reads; a refusal names the field key, never this. */
const SELECTOR_SENTINEL = '[data-testid="SYNTHETIC_SELECTOR_SENTINEL"]';

test("a plain selector reads the element's text, and the string form is always required", () => {
  assert.deepEqual(normalizeExtractField("name", '[data-testid="product-name"]'), { kind: "text", selector: '[data-testid="product-name"]', required: true });
});

test("an empty selector reads the item itself", () => {
  assert.deepEqual(normalizeExtractField("name", ""), { kind: "text", required: true });
});

test("a trailing @attribute reads that attribute instead of the text", () => {
  assert.deepEqual(normalizeExtractField("url", '[data-testid="product-link"]@href'), {
    kind: "attribute",
    selector: '[data-testid="product-link"]',
    attribute: "href",
    required: true
  });
});

test("the item's own attribute needs no selector", () => {
  assert.deepEqual(normalizeExtractField("id", "@data-product-id"), { kind: "attribute", attribute: "data-product-id", required: true });
});

test("an @ that is not an attribute name stays part of the selector", () => {
  assert.deepEqual(normalizeExtractField("owner", '[data-owner="a@b c"]'), { kind: "text", selector: '[data-owner="a@b c"]', required: true });
});

test("column: names the header whose cell the field reads", () => {
  assert.deepEqual(normalizeExtractField("price", "column:Price"), { kind: "column", header: "Price", required: true });
  assert.deepEqual(normalizeExtractField("price", "column:  Unit  price "), { kind: "column", header: "Unit price", required: true });
});

test("a column field with no header is rejected rather than matching every column", () => {
  assert.throws(() => normalizeExtractField("price", "column:   "), /names no column header/u);
});

test("each spec kind normalizes, its selector trimmed and a blank one reading the item", () => {
  const rows: Array<readonly [spec: ExtractField, expected: unknown]> = [
    [{ kind: "text", selector: " .name " }, { kind: "text", selector: ".name", required: true }],
    [{ kind: "attribute", selector: "a", attribute: " href " }, { kind: "attribute", selector: "a", attribute: "href", required: true }],
    [{ kind: "link", selector: "a" }, { kind: "link", selector: "a", required: true }],
    [{ kind: "value", selector: "input" }, { kind: "value", selector: "input", required: true }],
    [{ kind: "column", header: "  Unit  price " }, { kind: "column", header: "Unit price", required: true }],
    [{ kind: "text", selector: "   " }, { kind: "text", required: true }],
    [{ kind: "value", handling: "include" }, { kind: "value", required: true }]
  ];
  for (const [spec, expected] of rows) assert.deepEqual(normalizeExtractField("field", spec), expected, JSON.stringify(spec));
});

test("required defaults to true for a spec, and only false makes the field optional", () => {
  assert.equal(normalizeExtractField("field", { kind: "text", selector: ".a" })?.required, true);
  assert.equal(normalizeExtractField("field", { kind: "text", selector: ".a", required: true })?.required, true);
  assert.equal(normalizeExtractField("field", { kind: "text", selector: ".a", required: false })?.required, false);
  assert.equal(normalizeExtractField("field", { kind: "column", header: "Price", required: false })?.required, false);
});

test("an excluded field is dropped before anything could read it, whatever it names", () => {
  const excluded: ExtractField[] = [
    { kind: "text", selector: ".notes", handling: "exclude" },
    { kind: "value", selector: 'input[type="password"]', handling: "exclude", required: false },
    { kind: "column", header: "Card", handling: "exclude" },
    // Even a spec the page could not read is simply not read.
    { kind: "attribute", handling: "exclude" }
  ];
  for (const spec of excluded) assert.equal(normalizeExtractField("secret", spec), undefined, JSON.stringify(spec));
});

test("an encrypt field is refused as not implemented, naming the field and no selector", () => {
  let thrown: unknown;
  try {
    normalizeExtractField("card", { kind: "value", selector: SELECTOR_SENTINEL, handling: "encrypt" });
  } catch (error) {
    thrown = error;
  }
  const failure = (thrown as { failure?: Record<string, unknown> } | undefined)?.failure;
  assert.ok(thrown instanceof Error && failure !== undefined, `expected a refusal carrying a failure record, got ${String(thrown)}`);
  assert.equal(failure.code, "web.action.not_implemented");
  assert.equal(failure.category, "blocked_by_capability_or_policy");
  assert.equal(failure.expected, "the Encrypt column to be implemented");
  assert.match(String(failure.actual), /^field card asks for handling "encrypt"/u);
  assert.equal(`${thrown.message} ${JSON.stringify(failure)}`.includes("SYNTHETIC_SELECTOR_SENTINEL"), false);
});

test("a spec the page cannot honour throws, naming the field and never its selector", () => {
  const rows: Array<readonly [why: string, spec: unknown, message: RegExp]> = [
    ["an attribute field naming no attribute", { kind: "attribute", selector: SELECTOR_SENTINEL }, /reads an attribute but names none/u],
    ["an attribute field naming a blank attribute", { kind: "attribute", selector: SELECTOR_SENTINEL, attribute: "  " }, /reads an attribute but names none/u],
    ["a column field naming no header", { kind: "column", selector: SELECTOR_SENTINEL }, /reads a column but names no header/u],
    ["a kind the page does not know", { kind: "html", selector: SELECTOR_SENTINEL }, /kind of read the page does not know/u],
    ["a handling the page does not know", { kind: "text", selector: SELECTOR_SENTINEL, handling: "mask" }, /handling the page does not know/u],
    ["neither a string nor a spec", null, /neither a selector nor a field spec/u]
  ];
  for (const [why, spec, message] of rows) {
    assert.throws(() => normalizeExtractField("price", spec as ExtractField), (error: unknown) => {
      assert.ok(error instanceof Error, why);
      assert.match(error.message, message, why);
      assert.match(error.message, /"price"/u, why);
      assert.equal(error.message.includes("SYNTHETIC_SELECTOR_SENTINEL"), false, `${why}: the refusal quotes a selector`);
      return true;
    }, why);
  }
});
