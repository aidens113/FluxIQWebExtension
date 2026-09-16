// T1 coverage of what a proposed field says, which is decided without reading
// the page: decision D12's Exclude pre-selection for a sensitive source, and
// decision D16's optional field for one the page does not show in every item.
// Finding the sources needs a document, so which fields a real item exposes is
// proven by `e2e/content/tests/extraction/inference.spec.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { proposedFieldSpec, type FieldSource } from "../infer-fields";

const PRICE: FieldSource = { kind: "text", label: "product-price", selector: '[data-testid="product-price"]', sensitive: false };

test("a sensitive source is proposed excluded, so inference never proposes reading it", () => {
  const card: FieldSource = { kind: "value", label: "card-number", selector: 'input[name="card"]', sensitive: true };
  assert.deepEqual(proposedFieldSpec(card, 1), {
    kind: "value",
    selector: 'input[name="card"]',
    required: true,
    handling: "exclude"
  });
});

test("every kind is excluded when its element is sensitive, not only a control's value", () => {
  for (const kind of ["text", "link", "value", "attribute", "column"] as const) {
    const spec = proposedFieldSpec({ ...PRICE, kind, sensitive: true }, 1);
    assert.equal(spec.handling, "exclude", kind);
  }
});

test("an ordinary source carries no handling at all, so the picker's own default decides", () => {
  const spec = proposedFieldSpec(PRICE, 1);
  assert.ok(!Object.prototype.hasOwnProperty.call(spec, "handling"), JSON.stringify(spec));
  assert.deepEqual(spec, { kind: "text", selector: '[data-testid="product-price"]', required: true });
});

test("a field some items lack is proposed optional, so a record without it carries null", () => {
  assert.equal(proposedFieldSpec(PRICE, 0.75).required, false);
  assert.equal(proposedFieldSpec(PRICE, 0).required, false);
  assert.equal(proposedFieldSpec(PRICE, 1).required, true);
});

test("an attribute source names its attribute and a column source its header, and neither carries the other", () => {
  const image = proposedFieldSpec({ kind: "attribute", label: "product-image src", selector: "img", attribute: "src", sensitive: false }, 1);
  assert.deepEqual(image, { kind: "attribute", selector: "img", attribute: "src", required: true });
  const column = proposedFieldSpec({ kind: "column", label: "Price", header: "Price", columnIndex: 2, sensitive: false }, 1);
  assert.deepEqual(column, { kind: "column", header: "Price", required: true });
});
