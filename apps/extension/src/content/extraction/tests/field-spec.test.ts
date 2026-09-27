// T1 coverage of how an extract_list field becomes what the page reads: the
// string grammar, each structured spec kind, `required`, and the handling that
// is decided before the page is touched -- `exclude` dropping the field (D12)
// and `encrypt` refused as NOT_IMPLEMENTED.
//
// **`required` is the row that changed on 2026-09-26, and the reason is a live
// measurement.** Every form defaulted to required, so the ordinary thing a model
// writes -- four bare selectors -- failed the whole read on a page where three
// cards of forty-three carried no rating, and forty good rows were stored as
// nothing. A default that turns a wide answer into an empty one is the shape this
// product does not take: nothing is required unless the author wrote
// `required: true`, and the read states the gap instead of failing on it
// (`../field-spec.ts`, `content/actions/extract-list.ts`).
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

test("a plain selector reads the element's text, and the string form requires nothing: it has no way to say so", () => {
  assert.deepEqual(normalizeExtractField("name", '[data-testid="product-name"]'), { kind: "text", selector: '[data-testid="product-name"]', required: false });
});

test("an empty selector reads the item itself", () => {
  assert.deepEqual(normalizeExtractField("name", ""), { kind: "text", required: false });
});

test("a trailing @attribute reads that attribute instead of the text", () => {
  assert.deepEqual(normalizeExtractField("url", '[data-testid="product-link"]@href'), {
    kind: "attribute",
    selector: '[data-testid="product-link"]',
    attribute: "href",
    required: false
  });
});

test("the item's own attribute needs no selector", () => {
  assert.deepEqual(normalizeExtractField("id", "@data-product-id"), { kind: "attribute", attribute: "data-product-id", required: false });
});

test("an @ that is not an attribute name stays part of the selector", () => {
  assert.deepEqual(normalizeExtractField("owner", '[data-owner="a@b c"]'), { kind: "text", selector: '[data-owner="a@b c"]', required: false });
});

test("column: names the header whose cell the field reads", () => {
  assert.deepEqual(normalizeExtractField("price", "column:Price"), { kind: "column", header: "Price", required: false });
  assert.deepEqual(normalizeExtractField("price", "column:  Unit  price "), { kind: "column", header: "Unit price", required: false });
});

test("a column field with no header is rejected rather than matching every column", () => {
  assert.throws(() => normalizeExtractField("price", "column:   "), /names no column header/u);
});

test("each spec kind normalizes, its selector trimmed and a blank one reading the item", () => {
  const rows: Array<readonly [spec: ExtractField, expected: unknown]> = [
    [{ kind: "text", selector: " .name " }, { kind: "text", selector: ".name", required: false }],
    [{ kind: "attribute", selector: "a", attribute: " href " }, { kind: "attribute", selector: "a", attribute: "href", required: false }],
    [{ kind: "link", selector: "a" }, { kind: "link", selector: "a", required: false }],
    [{ kind: "value", selector: "input" }, { kind: "value", selector: "input", required: false }],
    [{ kind: "column", header: "  Unit  price " }, { kind: "column", header: "Unit price", required: false }],
    [{ kind: "text", selector: "   " }, { kind: "text", required: false }],
    [{ kind: "value", handling: "include" }, { kind: "value", required: false }]
  ];
  for (const [spec, expected] of rows) assert.deepEqual(normalizeExtractField("field", spec), expected, JSON.stringify(spec));
});

test("only an explicit true requires a field, and it still means exactly what it says", () => {
  // The capability is untouched; the default is what moved. A spec written
  // without `required` now means what the same field written as a bare selector
  // means, which is what keeps the two forms from reading differently.
  assert.equal(normalizeExtractField("field", { kind: "text", selector: ".a" })?.required, false);
  assert.equal(normalizeExtractField("field", { kind: "text", selector: ".a", required: true })?.required, true);
  assert.equal(normalizeExtractField("field", { kind: "text", selector: ".a", required: false })?.required, false);
  assert.equal(normalizeExtractField("field", { kind: "column", header: "Price", required: true })?.required, true);
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
