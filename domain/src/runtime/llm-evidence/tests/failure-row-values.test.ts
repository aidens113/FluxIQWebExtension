// What a repair can tell about the records it is being asked to act on.
//
// The complaint this answers is concrete. The campaign of 2026-09-17 captured
// the product catalogue twice from the same page: once for authoring a Flow and
// once for repairing one. The authoring packet carried all eight rows with
// their prices and ratings; the repair packet carried the rows and not one
// value. A repair asked which record to act on was being shown eight things it
// could not tell apart, because the failure budget was half the exploration
// budget and the trim gives up the ranked tail.
//
// Core's gate is now the exploration figure, so this asserts the consequence on
// the fixture that showed the problem: at the budget a repair is given, at
// least one row arrives whole -- its name, its price and its rating under the
// same `item.index` -- and at the budget it used to be given, none does.

import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWebLlmSnapshot, WEB_LLM_EVIDENCE_BYTE_BUDGETS, type WebLlmPageEvidence } from "..";

/** What a repair was given until Core's gate was raised. */
const FORMER_FAILURE_BUDGET = 3_000;

const PRODUCTS = [
  { name: "Ember Scented Candle", price: "$189.00", rating: "4.3 out of 5" },
  { name: "Drift Wool Throw", price: "$22.00", rating: "4.1 out of 5" },
  { name: "Harbour Ceramic Mug", price: "$14.50", rating: "4.6 out of 5" },
  { name: "Pinewood Serving Board", price: "$38.00", rating: "4.0 out of 5" },
  { name: "Slate Linen Napkins", price: "$27.25", rating: "4.4 out of 5" },
  { name: "Copper Pour-Over Kettle", price: "$96.00", rating: "4.8 out of 5" },
  { name: "Fern Stoneware Bowl", price: "$19.75", rating: "3.9 out of 5" },
  { name: "Ash Handled Basket", price: "$44.00", rating: "4.2 out of 5" }
];

test("a repair sees a whole catalogue row, which the budget it used to be given could not fit", () => {
  const page = catalogue();
  const failed = { selector: '[data-testid="product-1-add"]' };

  const now = sanitizeWebLlmSnapshot(page, { budget: "failure", failedAction: failed });
  const before = sanitizeWebLlmSnapshot(page, { maxEvidenceBytes: FORMER_FAILURE_BUDGET, failedAction: failed });

  assert.equal(wholeRows(before).length, 0, `the former ${FORMER_FAILURE_BUDGET}-byte budget carried a whole row`);
  assert.equal(wholeRows(now).length > 0, true, `no whole row at ${WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure} bytes: ${JSON.stringify(rowsSeen(now))}`);
  // Values, not just more rows: the thing that tells one record from another.
  const carried = JSON.stringify(now);
  assert.match(carried, /\$189\.00/u);
  assert.match(carried, /4\.3 out of 5/u);
  assert.equal(new TextEncoder().encode(carried).byteLength <= WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure, true, `${carried.length} bytes`);
});

test("the row the action failed on is one of the rows that survives", () => {
  const evidence = sanitizeWebLlmSnapshot(catalogue(), { budget: "failure", failedAction: { selector: '[data-testid="product-1-add"]' } });
  // The capture ranks the failed control first, so its own row is the one the
  // trim keeps. `failedTarget` naming a handle is the packet saying the control
  // is still in it; `failedTargetMissing` would mean the trim took it.
  assert.equal(typeof evidence.failedTarget, "string", JSON.stringify({ failedTarget: evidence.failedTarget, failedTargetMissing: evidence.failedTargetMissing }));
  assert.equal(evidence.failedTargetMissing, undefined);
  assert.equal(wholeRows(evidence).includes(1), true, `row 1 incomplete: ${JSON.stringify(rowsSeen(evidence))}`);
});

/** Which `item.index` values arrived with a name, a price and a rating. */
function wholeRows(evidence: WebLlmPageEvidence): number[] {
  return Object.entries(rowsSeen(evidence))
    .filter(([, seen]) => seen.name && seen.price && seen.rating)
    .map(([index]) => Number(index));
}

function rowsSeen(evidence: WebLlmPageEvidence): Record<number, { name: boolean; price: boolean; rating: boolean }> {
  const rows: Record<number, { name: boolean; price: boolean; rating: boolean }> = {};
  for (const element of evidence.elements) {
    const index = element.item?.index;
    if (index === undefined) continue;
    rows[index] ??= { name: false, price: false, rating: false };
    const said = `${element.name ?? ""} ${element.text ?? ""}`;
    if (PRODUCTS.some((product) => said.includes(product.name))) rows[index]!.name = true;
    if (/\$\d/u.test(said)) rows[index]!.price = true;
    if (/out of 5/u.test(said)) rows[index]!.rating = true;
  }
  return rows;
}

/**
 * The fixture, at the scale and in the order the real capture produced.
 *
 * Two things about it are load-bearing. The page is a real catalogue's size --
 * roughly ninety elements, as the campaign's own capture of this page was --
 * and the elements are in *ranked* order, not document order: the failed
 * control first, then the rest of the controls, then the text that describes
 * them. That ranking is why the old budget lost the values rather than losing
 * rows: prices and ratings are text, so they are the tail, and the tail is what
 * the trim gives up.
 */
function catalogue(): Record<string, unknown> {
  const row = (index: number): { controls: Record<string, unknown>[]; text: Record<string, unknown>[] } => {
    const product = PRODUCTS[index - 1]!;
    const context = { landmark: "main", heading: "All products", listPosition: { index, total: PRODUCTS.length } };
    return {
      controls: [
        { tagName: "a", selector: `[data-testid="product-${index}-link"]`, name: product.name, context },
        { tagName: "button", selector: `[data-testid="product-${index}-add"]`, name: "Add to cart", context },
        { tagName: "input", selector: `[data-testid="product-${index}-compare"]`, type: "checkbox", name: "Compare", context }
      ],
      text: [
        { tagName: "span", selector: `[data-testid="product-${index}-price"]`, visibleText: product.price, context },
        { tagName: "span", selector: `[data-testid="product-${index}-rating"]`, visibleText: product.rating, context },
        { tagName: "span", selector: `[data-testid="product-${index}-stock"]`, visibleText: index % 3 === 0 ? "Out of stock" : "In stock", context },
        { tagName: "p", selector: `[data-testid="product-${index}-blurb"]`, visibleText: `${product.name} is hand finished in small batches and ships within two working days.`, context }
      ]
    };
  };
  const rows = PRODUCTS.map((_, offset) => row(offset + 1));
  const failedSelector = '[data-testid="product-1-add"]';
  const controls = rows.flatMap((entry) => entry.controls);
  const filters = ["Sort by price", "Sort by rating", "In stock only", "Under $25", "Clear filters", "Search products"]
    .map((name, offset) => ({ tagName: "button", selector: `[data-testid="filter-${offset}"]`, name, context: { landmark: "navigation", heading: "Refine" } }));
  const pagination = [
    { tagName: "a", selector: '[data-testid="page-next"]', name: "Next page" },
    { tagName: "a", selector: '[data-testid="page-2"]', name: "Page 2" },
    { tagName: "a", selector: '[data-testid="page-3"]', name: "Page 3" }
  ];
  const interactive = [
    ...controls.filter((element) => element.selector === failedSelector),
    ...controls.filter((element) => element.selector !== failedSelector),
    ...filters,
    ...pagination
  ];
  const text = [
    ...rows.flatMap((entry) => entry.text),
    { tagName: "p", selector: '[data-testid="page-count"]', visibleText: "Page 1 of 3" },
    { tagName: "p", selector: '[data-testid="product-count"]', visibleText: "23 products" }
  ];
  return {
    url: "https://example.test/catalog",
    title: "Product catalog",
    elementTotal: interactive.length + text.length,
    interactiveElements: [...interactive, ...text]
  };
}
