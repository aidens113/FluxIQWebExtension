// A column name written slightly wrong resolves to the column it plainly means,
// on the *detected* path -- the one the extraction node's authoring text steers a
// model towards.
//
// The live failures these rows exist for:
// - `run-mu4wwkbc-df6cfe60` and six more catalog builds: the model detected the
//   eight product cards and then wrote `fields` keyed `name, price, rating, url`,
//   because those are the words the instruction used. Every one of them named no
//   detected column, the slot refused `web.handle.unknown_field`, and the build
//   fell back to guessed CSS that read eight cards and no field;
// - `run-mug776kx-0214b287`: the same refusal fourteen times in a row, never
//   corrected. A refusal restates the slip rather than absorbing it, and the
//   budget goes on being told instead of on the work.
//
// The rows are unit-level on purpose. `slot.test.ts` measures the same rule
// through the runtime over the captured detections; these build the column maps
// directly, because the cases that matter are two columns one name answers to,
// and a captured page gives one such pair rather than the several needed to show
// which signal decided.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationExtractField } from "../../../../../actions/extraction";
import { createWebLlmExtractionHandles, type WebLlmExtractionHandleScope } from "../../../structure";
import { keptWebExtractionColumns } from "../columns";
import { keptWebExtractionConditions } from "../conditions";
import { resolveWebExtractionSlot } from "../slot";

const testId = (id: string) => `[data-testid="${id}"]`;

/** The product-catalog detection's columns, as `structure/packet.ts` binds them (`tests/captured-detections.ts`). */
const CATALOG = {
  "product-image_src": { kind: "attribute", selector: testId("product-image"), attribute: "src", required: true },
  "product-image_alt": { kind: "attribute", selector: testId("product-image"), attribute: "alt", required: true },
  "product-name": { kind: "text", selector: testId("product-name"), required: true },
  "product-link": { kind: "link", selector: testId("product-link"), required: true },
  "product-price": { kind: "text", selector: testId("product-price"), required: true },
  "product-rating": { kind: "text", selector: testId("product-rating"), required: true },
  "stock-badge": { kind: "text", selector: testId("stock-badge"), required: true }
} as const satisfies Record<string, WebAutomationExtractField>;

/**
 * A star rating drawn as a widget: the label is prose a person reads ("4.5 out
 * of 5 stars") and the quantity is in `aria-valuenow`, which ARIA defines as a
 * number. Two columns whose names a model cannot tell apart, where only one can
 * answer "rated 4.0 or higher".
 */
const STARS = {
  "star-rating_label": { kind: "text", selector: testId("star-rating"), required: true },
  "star-rating_value": { kind: "attribute", selector: '[role="slider"]', attribute: "aria-valuenow", required: true }
} as const satisfies Record<string, WebAutomationExtractField>;

/** An inventory table, whose columns the model was shown by header as well as by key. */
const TABLE = {
  product: { kind: "column", header: "Product", required: true },
  price: { kind: "column", header: "Price", required: true },
  stock: { kind: "column", header: "Stock", required: true }
} as const satisfies Record<string, WebAutomationExtractField>;

function keptColumns(fields: unknown, detected: Record<string, WebAutomationExtractField> = CATALOG) {
  return keptWebExtractionColumns(fields, detected, ["fields"]);
}

/** A detected column as a read keeps it: the detection's coverage-derived `required` is not carried (`../columns.ts`, `unrequired`). */
function asKept(spec: WebAutomationExtractField): WebAutomationExtractField {
  return typeof spec === "string" ? spec : { ...spec, required: false };
}

function conditions(where: unknown, detected: Record<string, WebAutomationExtractField> = CATALOG, kept: Record<string, WebAutomationExtractField> = {}) {
  return keptWebExtractionConditions(where, { detected, kept }, ["where"]);
}

test("a column named in the instruction's own words resolves to the detected one, and the resolution says it assumed", () => {
  // Exactly what run 8's build wrote, and exactly what was refused.
  const kept = keptColumns({ name: "name", price: "price", rating: "rating" });
  assert.deepEqual(kept, {
    ok: true,
    fields: { name: asKept(CATALOG["product-name"]), price: asKept(CATALOG["product-price"]), rating: asKept(CATALOG["product-rating"]) },
    assumed: [
      { path: ["fields", "name"], written: "name", field: "product-name", how: "nearest", score: 0.733, among: "detected" },
      { path: ["fields", "price"], written: "price", field: "product-price", how: "nearest", score: 0.746, among: "detected" },
      { path: ["fields", "rating"], written: "rating", field: "product-rating", how: "nearest", score: 0.757, among: "detected" }
    ]
  });

  // A spelling variant is not a guess: `normalized` scores 1, and the fold that
  // makes it one is Core's -- case, separators and camel-case humps.
  for (const written of ["productName", "PRODUCT-NAME", "product_name", ".product-name"]) {
    assert.deepEqual(keptColumns({ name: written }), {
      ok: true,
      fields: { name: asKept(CATALOG["product-name"]) },
      assumed: [{ path: ["fields", "name"], written, field: "product-name", how: "normalized", score: 1, among: "detected" }]
    }, written);
  }

  // The key verbatim assumes nothing at all.
  assert.deepEqual(keptColumns({ name: "product-name" }), { ok: true, fields: { name: asKept(CATALOG["product-name"]) }, assumed: [] });

  // A table column is found by a near-miss header as well as by a near-miss key,
  // because the model was shown both. `column:` says the name is a header.
  assert.deepEqual(keptColumns({ cheapest: "column:Prise" }, TABLE), {
    ok: true,
    fields: { cheapest: asKept(TABLE.price) },
    assumed: [{ path: ["fields", "cheapest"], written: "column:Prise", field: "price", how: "nearest", score: 0.8, among: "detected" }]
  });
});

test("a column with no plausible candidate is still an honest failure", () => {
  // The failure has to come from there being no answer, never from a spelling.
  // These are measured misses below Core's floor. Ordinary vocabulary such as
  // `title`, and spelling slips such as `prce`, deliberately do not belong in
  // this row: the matcher can plausibly relate them to product-name and
  // product-price, which is the recovery this module exists to provide.
  for (const written of ["banana", "wombat", "#card > .price:nth-child(2)"]) {
    assert.deepEqual(keptColumns({ name: written }), { ok: false, issue: "web.handle.unknown_field", path: ["fields", "name"] }, written);
  }
  // A name written as a header, where nothing has a header at all.
  assert.deepEqual(keptColumns({ name: "column:Name" }), { ok: false, issue: "web.handle.unknown_field", path: ["fields", "name"] });
  assert.deepEqual(conditions([{ field: "banana", is: "absent" }]), { ok: false, issue: "web.handle.unknown_field", path: ["where", 0] });
});

test("two columns one name answers to are told apart by the shape the comparison needs", () => {
  // "rated 4.0 or higher" over a widget whose label and value are named alike.
  // Both score 0.688; the comparison is on the number in the value, and only
  // `aria-valuenow` holds one, so that is the column. This is the signal the
  // detected path has and the literal one does not -- not a sample value, which
  // a detection never carries (D3), but what the column's own spec reads.
  assert.deepEqual(conditions([{ field: "rating", atLeast: 4 }], STARS), {
    ok: true,
    where: [{ read: STARS["star-rating_value"], atLeast: 4 }],
    assumed: [{ path: ["where", 0], written: "rating", field: "star-rating_value", how: "nearest", score: 0.688, among: "detected" }]
  });
  // The same name, a comparison on the value's text: nothing distinguishes the
  // two columns, so nothing is claimed and the name alone decides.
  assert.deepEqual(conditions([{ field: "rating", contains: "out of 5" }], STARS), {
    ok: true,
    where: [{ read: STARS["star-rating_label"], contains: ["out of 5"] }],
    assumed: [{ path: ["where", 0], written: "rating", field: "star-rating_label", how: "nearest", score: 0.688, among: "detected" }]
  });

  // The other direction: an address is text and never a quantity, so a column
  // that reads one stands aside for a comparison on a number. `product-image`
  // answers to the `src` and the `alt` at the same score, and the `src` is the
  // one the comparison cannot be about.
  assert.deepEqual(conditions([{ field: "product-image", atLeast: 2 }]), {
    ok: true,
    where: [{ read: CATALOG["product-image_alt"], atLeast: 2 }],
    assumed: [{ path: ["where", 0], written: "product-image", field: "product-image_alt", how: "nearest", score: 0.881, among: "detected" }]
  });
  assert.deepEqual(conditions([{ field: "product-image", contains: "cover" }]), {
    ok: true,
    where: [{ read: CATALOG["product-image_src"], contains: ["cover"] }],
    assumed: [{ path: ["where", 0], written: "product-image", field: "product-image_src", how: "nearest", score: 0.881, among: "detected" }]
  });

  // Standing aside is not excluding. With nothing else plausible left, the
  // address column is still the answer, because a guess beats a dropped clause.
  assert.deepEqual(conditions([{ field: "product-lnk", atLeast: 2 }], { "product-link": CATALOG["product-link"] }), {
    ok: true,
    where: [{ read: CATALOG["product-link"], atLeast: 2 }],
    assumed: [{ path: ["where", 0], written: "product-lnk", field: "product-link", how: "nearest", score: 0.917, among: "detected" }]
  });
});

test("every name written exactly is read before any name is guessed at", () => {
  // The plan's own key, invented two lines above the condition that uses it. It
  // is not a guess and must not become one: `rating` would otherwise resolve to
  // the detected `product-rating` by similarity and report an assumption it did
  // not make.
  assert.deepEqual(conditions([{ field: "rating", atLeast: 4 }], CATALOG, { rating: CATALOG["product-rating"] }), {
    ok: true,
    where: [{ field: "rating", atLeast: 4 }],
    assumed: []
  });
  // The same ordering where the two readings disagree about the column, not just
  // about whether anything was assumed. A plan whose product name is the card's
  // link keeps the link under `name`; `name` also resolves to `product-name` by
  // similarity, and the key the plan wrote itself still wins.
  assert.deepEqual(conditions([{ field: "name", contains: "Sponsored", not: true }], CATALOG, { name: CATALOG["product-link"] }), {
    ok: true,
    where: [{ field: "name", contains: ["Sponsored"], not: true }],
    assumed: []
  });
  // A name neither vocabulary knows exactly is guessed at in the detection's
  // first, because that is the vocabulary the model was shown.
  assert.deepEqual(conditions([{ field: "name", contains: "Sponsored", not: true }], CATALOG, { label: CATALOG["stock-badge"] }), {
    ok: true,
    where: [{ read: CATALOG["product-name"], contains: ["Sponsored"], not: true }],
    assumed: [{ path: ["where", 0], written: "name", field: "product-name", how: "nearest", score: 0.733, among: "detected" }]
  });

  // The field map written the other way round -- the key names the column, the
  // value the name to keep it under. It is recognised only because the value
  // names no column, so a guess at `price` must not answer first.
  assert.deepEqual(keptColumns({ "product-price": "price" }), { ok: true, fields: { price: asKept(CATALOG["product-price"]) }, assumed: [] });

  // And a guess never takes a column another name claimed exactly. Written
  // alone, `product-image` resolves to the `src`; beside a name that says `src`
  // outright it resolves to the `alt`, rather than reading one column twice.
  assert.deepEqual(keptColumns({ image: "product-image" }), {
    ok: true,
    fields: { image: asKept(CATALOG["product-image_src"]) },
    assumed: [{ path: ["fields", "image"], written: "product-image", field: "product-image_src", how: "nearest", score: 0.881, among: "detected" }]
  });
  assert.deepEqual(keptColumns({ image: "product-image", source: "product-image_src" }), {
    ok: true,
    fields: { image: asKept(CATALOG["product-image_alt"]), source: asKept(CATALOG["product-image_src"]) },
    assumed: [{ path: ["fields", "image"], written: "product-image", field: "product-image_alt", how: "nearest", score: 0.881, among: "detected" }]
  });
});

test("the resolved slot carries every assumption its columns and its conditions made", () => {
  // The assumption has to survive to the slot's own answer, because that is where
  // a reader with a wrong answer in front of them looks: which column the read
  // actually ran over, and whether the name that chose it was written or guessed.
  const scope: WebLlmExtractionHandleScope = { projectId: "project.one", flowId: "flow.one" };
  const handles = createWebLlmExtractionHandles();
  const handle = handles.reserve();
  handles.retain(scope, {
    handle,
    location: "http://127.0.0.1:4173/scenarios/product-catalog/",
    extractList: { item: testId("product-card"), fields: CATALOG },
    itemCount: 8
  });

  const resolution = resolveWebExtractionSlot({
    handle,
    fields: { name: "name", price: "product-price" },
    where: [{ field: "product-ratings", atLeast: 4 }]
  }, scope, handles);
  assert.equal(resolution.status, "resolved");
  assert.deepEqual(resolution.status === "resolved" ? resolution.assumed : undefined, [
    { path: ["fields", "name"], written: "name", field: "product-name", how: "nearest", score: 0.733, among: "detected" },
    { path: ["where", 0], written: "product-ratings", field: "product-rating", how: "nearest", score: 0.933, among: "detected" }
  ]);

  // Every name written exactly, and the resolution says it assumed nothing.
  const exact = resolveWebExtractionSlot({ handle, fields: { name: "product-name" }, where: [{ field: "product-price", lessThan: 50 }] }, scope, handles);
  assert.deepEqual(exact.status === "resolved" ? exact.assumed : undefined, []);
});

// The everything store's cart, detected over hashed class names (lane A, cause
// #15, `t174-w34` F2): its columns' labels are paths, completed with the shape
// the page side read in every value (`(number)`, `(currency amount)`), and the
// keys are those labels'. The read the instruction asks for -- item, quantity
// and price -- named no detected column and was refused.
const CART_ITEM = "div_a_css-0y6s4m2_span";
const CART_QUANTITY = "div_div_css-0hhnejr_span_css-1o6vlrv_span_css-1gf1s47_number";
const CART_PRICE = "p_css-10muxo3_span_currency_amount";
const CART = {
  "data-line": { kind: "attribute", attribute: "data-line", required: true },
  img_src: { kind: "attribute", selector: "img", attribute: "src", required: true },
  img_alt: { kind: "attribute", selector: "img", attribute: "alt", required: true },
  "div_a_css-0y6s4m2_url": { kind: "link", selector: "div > a.css-0y6s4m2", required: true },
  [CART_ITEM]: { kind: "text", selector: "div > a.css-0y6s4m2 > span", required: true },
  "div_p_css-08ulstx": { kind: "text", selector: "div > p.css-08ulstx", required: true },
  "div_div_css-0hhnejr_span_css-1o6vlrv_span_1": { kind: "text", selector: "div > div.css-0hhnejr > span.css-1o6vlrv > span:nth-of-type(1)", required: true },
  [CART_QUANTITY]: { kind: "text", selector: "div > div.css-0hhnejr > span.css-1o6vlrv > span.css-1gf1s47", required: true },
  "div_div_css-0hhnejr_span_2": { kind: "text", selector: "div > div.css-0hhnejr > span:nth-of-type(2)", required: true },
  [CART_PRICE]: { kind: "text", selector: "p.css-10muxo3 > span", required: true }
} as const satisfies Record<string, WebAutomationExtractField>;

test("a cart read in the instruction's own words resolves each name to the one column of its kind, as a guess", () => {
  const kept = keptColumns({ item: "item", quantity: "quantity", price: "price" }, CART);
  if (!kept.ok) assert.fail(`refused ${JSON.stringify(kept)}`);
  assert.deepEqual(kept.fields, { item: asKept(CART[CART_ITEM]), quantity: asKept(CART[CART_QUANTITY]), price: asKept(CART[CART_PRICE]) });
  assert.deepEqual(kept.assumed, [
    { path: ["fields", "item"], written: "item", field: CART_ITEM, how: "nearest", score: 0, among: "detected" },
    { path: ["fields", "quantity"], written: "quantity", field: CART_QUANTITY, how: "nearest", score: 0, among: "detected" },
    // Core's own matcher relates "price" to the currency key above its floor, so price is a name match.
    { path: ["fields", "price"], written: "price", field: CART_PRICE, how: "nearest", score: 0.397, among: "detected" }
  ]);
  // The other words for the same kinds, in any case and with any separator.
  const other = keptColumns({ a: "Product Name", b: "qty", c: "unit_price" }, CART);
  if (!other.ok) assert.fail(`refused ${JSON.stringify(other)}`);
  assert.deepEqual(other.fields, { a: asKept(CART[CART_ITEM]), b: asKept(CART[CART_QUANTITY]), c: asKept(CART[CART_PRICE]) });
});

test("a name of a kind two columns have, or none has, is still refused: a kind decides only when it names one column", () => {
  const twoQuantities = { ...CART, "div_span_css-7q_number": { kind: "text", selector: "div > span.css-7q", required: true } } as const;
  assert.deepEqual(keptColumns({ quantity: "quantity" }, twoQuantities), { ok: false, issue: "web.handle.unknown_field", path: ["fields", "quantity"] });
  // A detection with no column of the kind: the catalog labels nothing as a number.
  assert.deepEqual(keptColumns({ quantity: "qty" }), { ok: false, issue: "web.handle.unknown_field", path: ["fields", "quantity"] });
  // A word that means no kind is refused as before.
  assert.deepEqual(keptColumns({ name: "wombat" }, CART), { ok: false, issue: "web.handle.unknown_field", path: ["fields", "name"] });
});
