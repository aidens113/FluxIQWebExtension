// Which picked columns the extraction journey keeps, under which names, and
// which it removes -- decided from the preview against the record oracle.

import assert from "node:assert/strict";
import test from "node:test";
import { planFieldReview, type PickedColumn } from "../field-review.js";

const ORIGIN = "http://127.0.0.1:41234";
const expected = [
  { name: "Desk lamp", price: "$20.00", url: "/scenarios/product-catalog/products/desk-lamp" },
  { name: "Floor lamp", price: null, url: "/scenarios/product-catalog/products/floor-lamp" },
];
const columns: PickedColumn[] = [
  { sourceKey: "card_text", label: "Card", included: true },
  { sourceKey: "product_name", label: "Product name", included: true },
  { sourceKey: "product_link", label: "Link", included: true },
  { sourceKey: "product_price", label: "Price", included: true },
];
// One row per previewed item, one cell per included column, in proposal order.
const preview = [
  ["Desk lamp $20.00", "Desk lamp", `${ORIGIN}/scenarios/product-catalog/products/desk-lamp`, "$20.00"],
  ["Floor lamp", "Floor lamp", `${ORIGIN}/scenarios/product-catalog/products/floor-lamp`, null],
];

test("each oracle field keeps the column whose every previewed value matches it, and the rest are removed", () => {
  const plan = planFieldReview({ columns, previewRows: preview, expected, context: { scenarioOrigin: ORIGIN } });
  assert.deepEqual(plan.kept, [
    { sourceKey: "product_name", field: "name" },
    { sourceKey: "product_price", field: "price" },
    { sourceKey: "product_link", field: "url" },
  ]);
  assert.deepEqual(plan.removed, ["card_text"]);
  assert.deepEqual(plan.unmatchedFields, []);
});

test("an absolute link on another origin, or no context at all, does not match a root-relative oracle value", () => {
  const elsewhere = preview.map(row => row.map(cell => typeof cell === "string" ? cell.replace(ORIGIN, "http://127.0.0.1:9") : cell));
  assert.deepEqual(planFieldReview({ columns, previewRows: elsewhere, expected, context: { scenarioOrigin: ORIGIN } }).unmatchedFields, ["url"]);
  assert.deepEqual(planFieldReview({ columns, previewRows: preview, expected }).unmatchedFields, ["url"]);
});

test("a field the oracle names optional may go unmatched; a required one is reported by its manifest name", () => {
  const withoutPrice = preview.map(row => [row[0]!, row[1]!, row[2]!]);
  const narrowed = columns.slice(0, 3);
  assert.deepEqual(planFieldReview({ columns: narrowed, previewRows: withoutPrice, expected, context: { scenarioOrigin: ORIGIN } }).unmatchedFields, ["price"]);
  assert.deepEqual(planFieldReview({ columns: narrowed, previewRows: withoutPrice, expected, optionalFields: ["price"], context: { scenarioOrigin: ORIGIN } }).unmatchedFields, []);
});

test("a column that opened excluded is neither kept nor removed, and preview cells index included columns only", () => {
  const excludedFirst: PickedColumn[] = [{ sourceKey: "password", label: "Password", included: false }, ...columns];
  const plan = planFieldReview({ columns: excludedFirst, previewRows: preview, expected, context: { scenarioOrigin: ORIGIN } });
  assert.equal(plan.kept.some(item => item.sourceKey === "password"), false);
  assert.equal(plan.removed.includes("password"), false);
  assert.deepEqual(plan.kept.map(item => item.sourceKey), ["product_name", "product_price", "product_link"]);
});

test("one column answers one field, and with no previewed row nothing is decided", () => {
  const twin = planFieldReview({ columns: [{ sourceKey: "only", label: "Only", included: true }], previewRows: [["same"], ["same"]], expected: [{ a: "same", b: "same" }, { a: "same", b: "same" }] });
  assert.deepEqual(twin.kept, [{ sourceKey: "only", field: "a" }]);
  assert.deepEqual(twin.unmatchedFields, ["b"]);
  const blind = planFieldReview({ columns, previewRows: [], expected, context: { scenarioOrigin: ORIGIN } });
  assert.deepEqual(blind.kept, []);
  assert.deepEqual(blind.unmatchedFields, ["name", "price", "url"]);
});
