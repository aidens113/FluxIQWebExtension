// T1 coverage of what a proposed field says, which is decided without reading
// the page: decision D12's Exclude pre-selection for a sensitive source, and
// decision D16's optional field for one the page does not show in every item.
// Finding the sources needs a document, so which fields a real item exposes is
// proven by `e2e/content/tests/extraction/inference.spec.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationExtractListRequestValue, type WebAutomationExtractField } from "@fluxiq-web-extension/domain/client";
import { readField } from "../field-reader";
import { normalizeExtractField } from "../field-spec";
import { inferFields, proposedFieldSpec, type FieldSource } from "../infer-fields";
import { itemFilterFor } from "../item-filter";
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

function documentCard(team: string, selected: boolean, marked: boolean): Element {
  return dom.el("li", {}, dom.el("article", { class: selected ? "panel focus" : "panel" },
    dom.el("div", { class: "metadata" }, dom.el("span", {}, team), dom.el("span", {}, "Office")),
    ...(marked ? [dom.el("em", { class: "approval" }, "Reviewed")] : []),
    dom.el("input", { type: "password", value: "private" })));
}

test("a selected ancestor does not duplicate a shared field as a partial column", () => {
  const run = [documentCard("Team A", true, true), documentCard("Team B", false, false), documentCard("Team C", false, false)];
  const fields = inferFields(run[0]!, run);
  assert.equal(holding(fields, run, ["Team A", "Team B", "Team C"]).length, 1);
  assert.equal(fields.some((field) => field.spec.selector?.includes(".focus")), false);
  assert.ok(fields.some((field) => field.coverage < 1 && read(run[0]!, field) === "Reviewed"));
  assert.equal(fields.some((field) => field.spec.handling !== "exclude" && read(run[0]!, field) === "private"), false);
});

test("same text on distinct subtype leaves is not an equivalent shared field", () => {
  const run = [true, false, false].map((special) => dom.el("li", {},
    dom.el("article", { class: special ? "panel subtype" : "panel" },
      dom.el("div", { class: "metadata" }, dom.el("span", {}, "Shared"), dom.el("span", {}, "Desk")),
      ...(special ? [dom.el("span", { class: "subtype-value" }, "Shared")] : []))));
  const fields = inferFields(run[0]!, run);
  assert.ok(fields.some((field) => field.coverage < 1 && field.spec.selector?.includes(".subtype-value") && read(run[0]!, field) === "Shared"));
});

test("a conflicting element beyond the discovery sample preserves a meaningful partial field", () => {
  const run = Array.from({ length: 13 }, (_, index) => documentCard(`Team ${index}`, index === 0, false));
  run.push(dom.el("li", {},
    dom.el("article", { class: "panel" }, dom.el("div", { class: "metadata" }, dom.el("span", {}, "Other"), dom.el("span", {}, "Desk"))),
    dom.el("article", { class: "panel focus" }, dom.el("div", { class: "metadata" }, dom.el("span", {}, "Owned"), dom.el("span", {}, "Desk")))));
  const fields = inferFields(run[0]!, run);
  assert.ok(fields.some((field) => field.spec.selector?.includes(".focus") && read(run.at(-1)!, field) === "Owned"));
});

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

// A group of lines only a position can name is offered whole (`line-group/`).
// Live run `run-mvcxvr3k-af919462` (step 0025): a results card listed its ways
// to get the item as same-class sibling lines of one container, and not every
// card had every line. Detection offered them only by position -- `div:1`,
// `div:2`, `div:3` -- so on a card without a pickup line "Delivery" sat in
// `div:1`, no column held the whole group, and a read asked for the items that
// can be delivered kept every row.

/** One card: a title, a price, and its lines in one container, each line with the same class. */
function waysCard(title: string, lines: readonly string[], extra: readonly string[] = []): Element {
  return dom.el("li", { class: "card" },
    dom.el("span", { class: "title" }, title),
    ...extra.map((text, index) => dom.el("span", { class: `extra-${index}` }, text)),
    dom.el("div", { class: "price" }, "$9.99"),
    dom.el("div", { class: "ways" }, ...lines.map((line) => dom.el("div", { class: "way" }, line))));
}

const WAYS_CARDS: ReadonlyArray<{ title: string; lines: readonly string[] }> = [
  { title: "Six rolls", lines: ["Pickup today", "Delivery today", "Shipping, arrives Thu"] },
  { title: "Twelve rolls", lines: ["Delivery tomorrow", "Shipping, arrives Fri"] },
  { title: "Two rolls", lines: ["Pickup today"] },
  { title: "Eight rolls", lines: ["Shipping, arrives Thu", "Pickup today"] },
  { title: "Four rolls", lines: ["Delivery today"] }
];

function readRecord(item: Element, fields: Record<string, WebAutomationExtractField>): Record<string, string | null> {
  return Object.fromEntries(Object.entries(fields).map(([key, field]) => {
    const reader = normalizeExtractField(key, field);
    return [key, reader === undefined ? null : readField(item, key, reader) ?? null];
  }));
}

test("a container of positional lines is offered whole, and every row reads its own lines joined in order", () => {
  const run = WAYS_CARDS.map(({ title, lines }) => waysCard(title, lines));
  const fields = inferFields(run[0]!, run);
  const group = fields.find((field) => field.spec.lines === true);
  assert.ok(group, JSON.stringify(fields.map((field) => [field.label, field.spec])));
  assert.equal(group.label, "div.ways (all lines)");
  assert.deepEqual(group.spec, { kind: "text", selector: ":scope div.ways", lines: true, required: true });
  assert.equal(group.coverage, 1);
  // The positional lines are still offered exactly as before, beside the group.
  const positional = fields.filter((field) => /div:nth-of-type\(\d\)$/u.test(field.spec.selector ?? "")).map((field) => field.spec.selector);
  assert.deepEqual(positional, [1, 2, 3].map((index) => `:scope > div.ways > div:nth-of-type(${index})`));
  assert.ok(fields.indexOf(group) < fields.findIndex((field) => field.spec.selector === positional[0]), "the group sits before its first line");
  // Read at run time through the same normalizer the list reader uses.
  const reader = normalizeExtractField(group.key, group.spec);
  assert.deepEqual(reader, { kind: "text", selector: ":scope div.ways", required: true, lines: true });
  assert.deepEqual(run.map((item) => readField(item, group.key, reader!)), [
    "Pickup today · Delivery today · Shipping, arrives Thu",
    "Delivery tomorrow · Shipping, arrives Fri",
    "Pickup today",
    "Shipping, arrives Thu · Pickup today",
    "Delivery today"
  ]);
  // A plain text read of the same container runs the lines together.
  assert.equal(readField(run[0]!, group.key, { kind: "text", selector: ":scope div.ways", required: true }), "Pickup todayDelivery todayShipping, arrives Thu");
});

test("where {field: <group key>, contains} keeps exactly the rows whose group has the line, through the domain's request reader", () => {
  const run = WAYS_CARDS.map(({ title, lines }) => waysCard(title, lines));
  const fields = inferFields(run[0]!, run);
  const group = fields.find((field) => field.spec.lines === true)!;
  const title = fields.find((field) => field.spec.selector === ":scope span.title")!;
  assert.ok(title, JSON.stringify(fields.map((field) => field.spec.selector)));
  const kept = (where: Array<Record<string, unknown>>): string[] => {
    const request = webAutomationExtractListRequestValue({ item: "li.card", fields: Object.fromEntries(fields.map((field) => [field.key, field.spec])), where });
    assert.ok(request, "the domain reads the request");
    assert.deepEqual(request.fields[group.key], group.spec, "the group's spec survives the reader");
    const filter = itemFilterFor(request)!;
    return run.filter((item) => filter(item, readRecord(item, request.fields)).length === 0).map((item) => readField(item, "title", { kind: "text", selector: title.spec.selector!, required: true }) as string);
  };
  assert.deepEqual(kept([{ field: group.key, contains: "Delivery" }]), ["Six rolls", "Twelve rolls", "Four rolls"]);
  assert.deepEqual(kept([{ field: group.key, contains: "Pickup" }]), ["Six rolls", "Two rolls", "Eight rolls"]);
  // The first positional line is what a condition could name before, and it
  // keeps a different set: "Delivery" sits in it only where no line comes first.
  const first = fields.find((field) => field.spec.selector === ":scope > div.ways > div:nth-of-type(1)")!;
  assert.deepEqual(kept([{ field: first.key, contains: "Delivery" }]), ["Twelve rolls", "Four rolls"]);
});

test("a container with one line, or lines named by their own class, offers no group", () => {
  const single = ["A", "B", "C"].map((title) => waysCard(title, ["Pickup today"]));
  assert.equal(inferFields(single[0]!, single).some((field) => field.spec.lines === true), false);
  const named = ["A", "B", "C"].map((title) => dom.el("li", { class: "card" },
    dom.el("span", { class: "title" }, title),
    dom.el("div", { class: "ways" }, dom.el("div", { class: "pickup" }, "Pickup today"), dom.el("div", { class: "ship" }, "Shipping"))));
  assert.equal(inferFields(named[0]!, named).some((field) => field.spec.lines === true), false);
});

test("late ordinary data and partial positional lines survive more than twenty-four earlier columns", () => {
  const extra = Array.from({ length: 30 }, (_, index) => `value ${index}`);
  const run = WAYS_CARDS.map(({ title, lines }) => waysCard(title, lines, extra));
  const fields = inferFields(run[0]!, run);
  assert.ok(fields.length > 24);
  assert.equal(holding(fields, run, run.map(() => "value 29")).length, 1);
  assert.equal(holding(fields, run, run.map(() => "$9.99")).length, 1);
  assert.ok(fields.some((field) => field.spec.lines === true));
  const selectors = fields.map((field) => field.spec.selector);
  assert.equal(selectors.includes(":scope > div.ways > div:nth-of-type(2)"), true);
  assert.equal(selectors.includes(":scope > div.ways > div:nth-of-type(3)"), true);
  assert.deepEqual(inferFields(run[0]!, run), fields, "proposal order and keys are deterministic");
});

test("a record exposing more than sixty-four sources remains bounded at discovery", () => {
  const extra = Array.from({ length: 100 }, (_, index) => `value ${index}`);
  const run = [waysCard("A", [], extra), waysCard("B", [], extra)];
  const fields = inferFields(run[0]!, run);
  assert.equal(fields.length, 64);
  assert.equal(holding(fields, run, run.map(() => "value 62")).length, 1);
  assert.equal(holding(fields, run, run.map(() => "value 63")).length, 0);
});

// One list, two item templates (live run `run-mvczv4jn-1b61183c`, step 0021).
// An entry by a person states `time · ...` under its title; an entry posted in
// a group states `author · time · ...`, so the same position holds the time in
// one template and the author in the other. A column keyed by the first item's
// position read the author in every group entry, and the author's own column
// existed only in personal entries. The time link shows a short age and states
// the full date only in its `aria-label`. A shared entry quotes another post,
// whose own time link sits in a box below the sharer's.

type EntryValues = { author: string; time: string; date: string; group?: string; quoted?: { page: string; time: string } };

const ENTRIES: readonly EntryValues[] = [
  { author: "Aisha Khan", time: "1h", date: "Monday 21 September 2026 at 05:55" },
  { author: "Elena Sokolova", time: "3h", date: "Monday 21 September 2026 at 03:10", group: "Seed Swap" },
  { author: "Tom Becker", time: "5h", date: "Monday 21 September 2026 at 01:40" },
  { author: "Priya Nair", time: "1d", date: "Sunday 20 September 2026 at 07:00", group: "Night Runners" },
  { author: "Lena Vogt", time: "2d", date: "Saturday 19 September 2026 at 18:25" },
  { author: "Marta Ruiz", time: "3d", date: "Friday 18 September 2026 at 09:00", quoted: { page: "Harbour News", time: "4d" } }
];

function entry(values: EntryValues, index: number): Element {
  const author = () => dom.el("a", { class: "meta", href: `/people/p${index}/?ref=${index}a` }, values.author);
  const time = dom.el("a", { class: "meta", href: `/posts/${index}/?ref=${index}t`, "aria-label": values.date }, dom.el("span", {}, values.time));
  const dot = () => dom.el("span", { "aria-hidden": "true" }, " · ");
  const title = values.group === undefined
    ? dom.el("h3", { class: "title" }, dom.el("span", {}, dom.el("strong", {}, author())))
    : dom.el("h3", { class: "title" }, dom.el("span", {}, dom.el("a", { class: "meta", href: `/groups/g${index}/` }, values.group)));
  const byline = values.group === undefined
    ? dom.el("div", { class: "byline" }, dom.el("span", {}, time), dot())
    : dom.el("div", { class: "byline" }, dom.el("span", {}, author()), dot(), dom.el("span", {}, time), dot());
  const quoted = values.quoted === undefined ? [] : [dom.el("div", { class: "box" },
    dom.el("h4", {}, dom.el("a", { class: "meta", href: `/pages/q${index}/` }, values.quoted.page)),
    dom.el("div", { class: "byline" }, dom.el("span", {}, dom.el("a", { class: "meta", href: `/posts/${index}q/`, "aria-label": "Thursday 17 September 2026 at 12:00" }, dom.el("span", {}, values.quoted.time)))))];
  return dom.el("div", { class: "entry" },
    dom.el("div", { class: "head" }, dom.el("a", { class: "avatar", href: `/people/p${index}/` }), dom.el("div", {}, title, byline)),
    dom.el("div", { class: "message" }, `Message number ${index}`),
    ...quoted);
}

/** Every proposed field's value on every item, read as a list read reads it. */
function readAll(fields: ReturnType<typeof inferFields>, run: readonly Element[]): Array<{ field: ReturnType<typeof inferFields>[number]; values: Array<string | null> }> {
  return fields.map((field) => ({ field, values: run.map((item) => readRecord(item, { [field.key]: field.spec })[field.key] ?? null) }));
}

test("a column means one kind of element in every item, whatever template the item uses", () => {
  const run = ENTRIES.map(entry);
  const fields = inferFields(run[0]!, run);
  const read = readAll(fields, run);
  const shown = JSON.stringify(read.map(({ field, values }) => [field.label, field.spec.selector, field.spec.attribute, values]));
  const times = ENTRIES.map((values) => values.time);
  const authors = ENTRIES.map((values) => values.author);
  const time = read.filter(({ field, values }) => field.spec.kind === "text" && times.every((value, index) => values[index] === value));
  assert.ok(time.length >= 1, `a text column reads the time in every item: ${shown}`);
  // The first item's positional column is that column, so its key is the one a saved Flow already names.
  assert.ok(time.some(({ field }) => /byline > span:1 > a\.meta$/u.test(field.label)), shown);
  assert.ok(read.some(({ field, values }) => field.spec.kind === "text" && authors.every((value, index) => values[index] === value)), `a text column reads the author in every item: ${shown}`);
  // No column reads a time in one item and an author in another.
  for (const { field, values } of read) {
    const mixes = values.some((value) => value !== null && times.includes(value)) && values.some((value) => value !== null && authors.includes(value));
    assert.equal(mixes, false, `${field.label} mixes kinds: ${JSON.stringify(values)}`);
  }
});

test("the full date a time link states only in its aria-label is offered as a column, and read in every item", () => {
  const run = ENTRIES.map(entry);
  const fields = inferFields(run[0]!, run);
  const date = readAll(fields, run).filter(({ field }) => field.spec.kind === "attribute" && field.spec.attribute === "aria-label");
  assert.ok(date.length >= 1, JSON.stringify(fields.map((field) => [field.label, field.spec])));
  assert.deepEqual(date[0]!.values, ENTRIES.map((values) => values.date));
  assert.equal(date[0]!.field.coverage, 1);
  // The label is page structure: the path and the attribute's name, never the date (D3).
  assert.match(date[0]!.field.label, / aria-label$/u);
  assert.doesNotMatch(date[0]!.field.label, /September|2026/u);
});
