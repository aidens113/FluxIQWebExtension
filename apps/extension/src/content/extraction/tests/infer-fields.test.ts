// T1 coverage of what a proposed field says, which is decided without reading
// the page: decision D12's Exclude pre-selection for a sensitive source, and
// decision D16's optional field for one the page does not show in every item.
// Finding the sources needs a document, so which fields a real item exposes is
// proven by `e2e/content/tests/extraction/inference.spec.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { readField } from "../field-reader";
import { inferFields, proposedFieldSpec, type FieldSource } from "../infer-fields";
import { fakeShadowDom } from "./fake-shadow-dom";

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

// And the one source decided on a document here: an element whose words the
// page draws only in an open shadow root. The professional network's sent
// invitations draw each request's age as a childless `gl-time-ago` whose
// shadow root holds "Sent 1 month ago", and until 2026-09-30 no column was
// proposed for it, so "a month or more ago" had nothing to filter on.

const dom = fakeShadowDom();

/** The last step of a selector naming the `gl-time-ago` host, which carries no class. */
const TIME_AGO_STEP = /> gl-time-ago(?::not\(\[class\]\))?$/u;

function sentRow(name: string, age: string | undefined): Element {
  const time = dom.el("gl-time-ago", { datetime: "2026-08-19T08:00:00.000Z", format: "sent" });
  if (age !== undefined) dom.shadow(time, dom.el("span", {}, age));
  return dom.el("li", { "data-entity-urn": "urn:gl:invitation:1" },
    dom.el("div", {}, dom.el("div", {}, dom.el("strong", {}, name)), dom.el("div", {}, "Data engineer"), time),
    dom.el("div", {}, dom.el("button", { type: "button" }, "Withdraw")));
}

test("an element whose words are only in its open shadow root is proposed as a text column that reads them", () => {
  const run = [sentRow("Aoife Brennan", "Sent 1 month ago"), sentRow("Rosa Meijer", "Sent 4 weeks ago"), sentRow("Marit Dekker", "Sent 8 months ago")];
  const fields = inferFields(run[0]!, run);
  const age = fields.find((field) => field.spec.kind === "text" && TIME_AGO_STEP.test(field.spec.selector ?? ""));
  assert.ok(age, JSON.stringify(fields.map((field) => field.spec)));
  assert.equal(age.coverage, 1);
  assert.equal(age.spec.required, true);
  // The label is page structure, never the words read (D3).
  assert.doesNotMatch(age.label, /month|week|Sent/u);
  const reader = { kind: "text" as const, selector: age.spec.selector!, required: true };
  assert.deepEqual(run.map((row) => readField(row, age.key, reader)), ["Sent 1 month ago", "Sent 4 weeks ago", "Sent 8 months ago"]);
});

test("an element with no words in its light DOM or its shadow root is not proposed", () => {
  const run = [sentRow("Aoife Brennan", undefined), sentRow("Rosa Meijer", undefined)];
  const fields = inferFields(run[0]!, run);
  assert.equal(fields.some((field) => TIME_AGO_STEP.test(field.spec.selector ?? "")), false, JSON.stringify(fields.map((field) => field.spec)));
});

// Three columns detection got wrong on real cards (t194-w28): a title whose
// heading sometimes holds a classed badge before it, a price the card draws in
// pieces, and fields named by their place under the card body, which a layout
// change breaks.

/** Reads a proposed field off an item, as a list read does. */
function read(item: Element, field: { key: string; spec: { kind: string; selector?: string | undefined } }): string | null | undefined {
  return readField(item, field.key, { kind: "text", ...(field.spec.selector === undefined ? {} : { selector: field.spec.selector }), required: false });
}

/** The proposed text fields that read exactly `values` off `run`, item for item. */
function holding(fields: ReturnType<typeof inferFields>, run: readonly Element[], values: readonly string[]): ReturnType<typeof inferFields> {
  return fields.filter((field) => field.spec.kind === "text" && run.every((item, index) => read(item, field) === values[index]));
}

function auctionCard(title: string, fresh: boolean): Element {
  const heading = dom.el("div", { role: "heading" }, ...(fresh ? [dom.el("span", { class: "badge" }, "New listing")] : []), dom.el("span", {}, title));
  return dom.el("li", { class: "card" },
    dom.el("div", { class: "info" },
      dom.el("a", { class: "title", href: "/itm/1" }, heading),
      dom.el("div", { class: "line" }, dom.el("span", {}, "Used"))));
}

test("a heading's unclassed title is one column whether or not a classed badge sits before it", () => {
  const titles = ["Kestrel 35 camera", "Kestrel 35 body", "Kestrel 35 kit"];
  const run = [auctionCard(titles[0]!, false), auctionCard(titles[1]!, true), auctionCard(titles[2]!, false)];
  const fields = inferFields(run[0]!, run);
  const title = holding(fields, run, titles);
  assert.equal(title.length, 1, JSON.stringify(fields.map((field) => [field.label, field.spec.selector, field.coverage])));
  assert.equal(title[0]!.coverage, 1);
  // The label is the path as it was written before: `span`, not the selector's `span:not([class])`.
  assert.match(title[0]!.label, /> div > span$/u);
  // The badge stays its own, partial column.
  assert.ok(fields.some((field) => field.coverage < 1 && read(run[1]!, field) === "New listing"));
});

function marketCard(layout: "grid" | "list", values: { title: string; whole: string; fraction: string; original: string; rating: string; store: string }): Element {
  const image = dom.el("a", { class: "link", href: "/item/1" }, dom.el("img", { class: "image", src: "/1.svg", alt: "" }));
  const heading = dom.el("a", { class: "link", href: "/item/1" }, dom.el("div", { class: "title" }, values.title));
  const price = dom.el("div", { class: "price" }, dom.el("span", {}), dom.el("span", {}, values.whole), dom.el("span", {}, values.fraction), dom.el("span", {}, " €"));
  const original = dom.el("div", { class: "meta" }, dom.el("span", { class: "original" }, values.original), dom.el("span", { class: "discount" }, "-45%"));
  const rating = dom.el("div", { class: "meta" }, dom.el("span", { class: "stars" }), dom.el("span", { class: "rating" }, values.rating));
  const store = dom.el("div", { class: "store" }, values.store);
  return layout === "grid"
    ? dom.el("div", { class: "card" }, image, dom.el("div", { class: "body" }, heading, price, original, rating, store))
    : dom.el("div", { class: "card" }, image, dom.el("div", { class: "body" }, heading, rating), dom.el("div", { class: "aside" }, price, original, store));
}

const MARKET = [
  { title: "USB-C hub 7-in-1", whole: "16", fraction: ",49", original: "29,99 €", rating: "4.8", store: "Nordpunkt" },
  { title: "USB-C hub 4-port", whole: "12", fraction: ",49", original: "25,99 €", rating: "4.6", store: "Kabelhaus" },
  { title: "USB-C dock", whole: "39", fraction: ",00", original: "59,00 €", rating: "4.5", store: "Nordpunkt" }
];

test("a price drawn in sibling spans is one currency-amount column, beside the struck-through original", () => {
  const run = MARKET.map((values) => marketCard("grid", values));
  const fields = inferFields(run[0]!, run);
  const price = holding(fields, run, ["16,49 €", "12,49 €", "39,00 €"]);
  assert.equal(price.length, 1, JSON.stringify(fields.map((field) => [field.label, field.spec.selector])));
  assert.match(price[0]!.label, /\(currency amount\)$/u);
  assert.equal(holding(fields, run, MARKET.map((values) => values.original)).length, 1, "the original price stays its own column");
  // Its pieces are the price's, not columns of their own.
  assert.equal(holding(fields, run, MARKET.map((values) => values.whole)).length, 0);
  assert.equal(holding(fields, run, MARKET.map((values) => values.fraction)).length, 0);
});

test("fields detected on the grid read the same columns on the list layout, under the labels the grid showed", () => {
  const grid = MARKET.map((values) => marketCard("grid", values));
  const list = MARKET.map((values) => marketCard("list", values));
  const fields = inferFields(grid[0]!, grid);
  for (const column of ["title", "store", "rating", "original"] as const) {
    const onGrid = holding(fields, grid, MARKET.map((values) => values[column]));
    assert.equal(onGrid.length, 1, `${column}: ${JSON.stringify(fields.map((field) => [field.label, field.spec.selector]))}`);
    assert.deepEqual(list.map((item) => read(item, onGrid[0]!)), MARKET.map((values) => values[column]), `${column} on the list layout via ${onGrid[0]!.spec.selector}`);
    // The label a model is shown is still the element's path on the grid.
    assert.match(onGrid[0]!.label, / > /u, column);
  }
  const price = holding(fields, grid, ["16,49 €", "12,49 €", "39,00 €"])[0]!;
  assert.deepEqual(list.map((item) => read(item, price)), ["16,49 €", "12,49 €", "39,00 €"]);
});

test("a class two elements of some item share is not a field's name: that field keeps its path", () => {
  const card = (second: boolean) => dom.el("div", { class: "card" },
    dom.el("div", { class: "row" }, dom.el("span", { class: "tag" }, "Choice")),
    dom.el("div", { class: "row" }, ...(second ? [dom.el("span", { class: "tag" }, "Ships from Spain")] : [])));
  const run = [card(false), card(true)];
  const fields = inferFields(run[0]!, run);
  const choice = fields.find((field) => read(run[0]!, field) === "Choice");
  assert.ok(choice, JSON.stringify(fields.map((field) => field.spec.selector)));
  assert.match(choice.spec.selector ?? "", /^:scope > /u);
  assert.equal(read(run[1]!, choice), "Choice");
});

test("a field read by its own class is labelled with the path most cards give it, not the first card's", () => {
  // The first card is an advertisement with a "Sponsored" row above its price,
  // which pushes its title a row down; the other three are listings. The
  // title's row and the place's row carry no class, so the step to the title
  // is positional: `div:3` on the advertisement, `div:2` on a listing.
  const card = (title: string, sponsored: boolean) => dom.el("div", { class: "wrap" },
    dom.el("a", { class: "card", href: "/item/1" },
      ...(sponsored ? [dom.el("div", { class: "sponsor" }, dom.el("span", {}, "Sponsored"))] : []),
      dom.el("div", { class: "row" }, dom.el("span", { class: "price" }, "£240")),
      dom.el("div", {}, dom.el("span", { class: "title" }, title)),
      dom.el("div", {}, dom.el("span", { class: "place" }, "Leeds"))));
  const titles = ["Advertised bike", "Ridgeline", "Hardtail", "Tourer"];
  const run = titles.map((title, index) => card(title, index === 0));
  const fields = inferFields(run[0]!, run);
  const title = holding(fields, run, titles);
  assert.equal(title.length, 1, JSON.stringify(fields.map((field) => [field.label, field.spec.selector, field.coverage])));
  assert.equal(title[0]!.coverage, 1);
  assert.equal(title[0]!.spec.selector, ":scope span.title");
  assert.equal(title[0]!.label, "a.card > div:2 > span.title");
});
