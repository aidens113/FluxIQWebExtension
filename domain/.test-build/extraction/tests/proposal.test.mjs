// src/extraction/tests/proposal.test.ts
import assert from "node:assert/strict";
import test from "node:test";
var proposal = {
  container: '[data-testid="product-grid"]',
  item: '[data-testid^="product-card"]',
  itemCount: 8,
  fields: [
    { key: "product_name", label: "product-name", spec: { kind: "text", selector: '[data-testid="product-name"]' }, coverage: 1 },
    { key: "link", label: "a[href]", spec: { kind: "link", selector: "a" }, coverage: 1 },
    { key: "price", label: "Price", spec: { kind: "column", header: "Price", required: false }, coverage: 0.75 },
    { key: "password", label: "password", spec: { kind: "value", selector: "input", handling: "exclude" }, coverage: 1 }
  ],
  pagination: { next: "a[rel=next]", maxPages: 5 },
  confidence: 0.9
};
test("a proposal's fields are an extract_list request as they stand", () => {
  const request = {
    item: proposal.item,
    fields: Object.fromEntries(proposal.fields.map((field) => [field.key, field.spec])),
    ...proposal.pagination ? { paginate: proposal.pagination } : {}
  };
  assert.deepEqual(Object.keys(request.fields), ["product_name", "link", "price", "password"]);
  assert.deepEqual(request.fields.password, { kind: "value", selector: "input", handling: "exclude" });
});
test("a proposed field's spec cannot carry an element fingerprint", () => {
  const field = {
    key: "product_name",
    label: "product-name",
    // @ts-expect-error A fingerprint records the element's text, value and link target, which are page values.
    spec: { kind: "text", element: { text: "page text" } },
    coverage: 1
  };
  assert.equal(field.key, "product_name");
});
