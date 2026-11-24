// A run whose items are groups of records -- a heading over a list -- is read as
// the records of the target's group, never one row per group (`../group-records.ts`,
// t1022, `run-mwuxd2v9-33928ea3`).
//
// The page is the Node stub `../../tests/fake-shadow-dom.ts`, built in the
// recorded page's structure: sibling sections of one template, each a header
// holding a heading and a "See all" link over a list of cards. The fixture is a
// library's home page with two shelves of books, never a shop.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationItemSignature, type WebAutomationExtractField } from "@fluxiq-web-extension/domain/client";
import { contentFieldCount } from "../../content-fields";
import { readField } from "../../field-reader";
import { normalizeExtractField } from "../../field-spec";
import { inferFields } from "../../infer-fields";
import { fakeShadowDom } from "../../tests/fake-shadow-dom";
import { groupRecordsStart } from "../group-records";

const dom = fakeShadowDom();

/** The template signature every grouping in extraction uses, without the describe-element test id lookup the stub cannot need. */
function signatureOf(element: Element): string {
  return webAutomationItemSignature({ tagName: element.tagName, role: element.getAttribute("role"), testId: undefined, classes: element.classList });
}

type Book = { title: string; copies: string; rating: string };

/** One book card: its title link, its copies on the shelf, its rating, and a Reserve button. */
function card({ title, copies, rating }: Book): Element {
  return dom.el("li", {},
    dom.el("a", { class: "c-title", href: `/book/${title.toLowerCase().replace(/\W+/gu, "-")}` }, dom.el("span", { class: "c-name" }, title)),
    dom.el("div", { class: "c-meta" }, dom.el("span", { class: "c-copies" }, copies), dom.el("span", { class: "c-rating" }, rating)),
    dom.el("button", { class: "c-reserve" }, "Reserve"));
}

/** A shelf as the recorded page draws one: a header with a heading and a "See all" link, over the cards. */
function shelf(heading: string, books: Book[], extra: Element[] = []): Element {
  return dom.el("section", { class: "shelf" },
    dom.el("div", { class: "shelf-head" }, dom.el("h2", {}, heading), dom.el("a", { href: "/search?q=all" }, "See all")),
    ...extra,
    dom.el("ul", { class: "shelf-list" }, ...books.map(card)));
}

const NEW_ARRIVALS: Book[] = [
  { title: "Tide Charts", copies: "3 on shelf", rating: "4.1" },
  { title: "Salt Roads", copies: "1 on shelf", rating: "4.7" },
  { title: "Paper Kites", copies: "2 on shelf", rating: "4.4" },
  { title: "Lantern Hill", copies: "4 on shelf", rating: "4.9" },
  { title: "Quiet Orchard", copies: "1 on shelf", rating: "4.2" }
];
const STAFF_PICKS: Book[] = [
  { title: "Glass Harbor", copies: "2 on shelf", rating: "4.6" },
  { title: "Salt Roads", copies: "1 on shelf", rating: "4.7" },
  { title: "Winter Ledger", copies: "5 on shelf", rating: "4.0" }
];

/** The home page: two shelves side by side in its main region. */
function homePage(): Element[] {
  const shelves = [shelf("New at Elm Street", NEW_ARRIVALS), shelf("Staff picks", STAFF_PICKS)];
  dom.el("main", {}, dom.el("div", { class: "hero" }, dom.el("h1", {}, "Your library")), ...shelves);
  return shelves;
}

/** Each element's record, read as a list read reads it. */
function records(items: readonly Element[], fields: Record<string, WebAutomationExtractField>): Array<Record<string, string | null>> {
  return items.map((item) => Object.fromEntries(Object.entries(fields).map(([key, field]) => {
    const reader = normalizeExtractField(key, field);
    return [key, reader === undefined ? null : readField(item, key, reader) ?? null];
  })));
}

test("the recorded shape: read as a list of two shelves, each row is a shelf's first card, the rest flattened by place", () => {
  const shelves = homePage();
  const fields = inferFields(shelves[0]!, shelves);
  const positional = fields.filter((field) => /li:\d/u.test(field.label ?? ""));
  assert.ok(positional.length > 0, "the shelf's cards are offered as columns by their place in the shelf");
  const firstTitle = fields.find((field) => field.spec.selector !== undefined && /li:nth-of-type\(1\) > a\.c-title > span/u.test(field.spec.selector));
  assert.ok(firstTitle, JSON.stringify(fields.map((field) => field.spec.selector)));
  const rows = records(shelves, { title: firstTitle.spec as WebAutomationExtractField });
  assert.deepEqual(rows.map((row) => row.title), ["Tide Charts", "Glass Harbor"], "two rows: the first card of each shelf, as the run kept 2 rows of 8");
});

test("aimed at a shelf, the records are that shelf's cards, every column read per card", () => {
  const shelves = homePage();
  const start = groupRecordsStart(shelves[0]!, shelves, signatureOf);
  assert.ok(start, "a heading over a list is a group");
  const cards = Array.from(start.parentElement!.children);
  assert.equal(cards.length, NEW_ARRIVALS.length);
  assert.equal(start, cards[0]);
  const fields = inferFields(cards[0]!, cards);
  assert.ok(contentFieldCount(fields) >= 2, "the cards are records, not the shelf's decoration");
  assert.ok(fields.every((field) => !/li:\d/u.test(field.label ?? "")), "no column is a card's place");
  const title = fields.find((field) => field.spec.selector?.includes("c-name"));
  const rating = fields.find((field) => field.spec.selector?.includes("c-rating"));
  assert.ok(title && rating, JSON.stringify(fields.map((field) => field.spec.selector)));
  const rows = records(cards, { title: title.spec as WebAutomationExtractField, rating: rating.spec as WebAutomationExtractField });
  assert.deepEqual(rows, NEW_ARRIVALS.map(({ title: name, rating: stars }) => ({ title: name, rating: stars })));

  const other = groupRecordsStart(shelves[1]!, shelves, signatureOf);
  assert.equal(other?.parentElement, shelves[1]!.querySelector("ul.shelf-list"), "the other shelf's heading names the other shelf's cards");
});

test("a card's rating stars, a run of their own inside it, never stand in for the cards", () => {
  const stars = (count: number): Element => dom.el("div", { class: "stars" }, ...Array.from({ length: count }, () => dom.el("i", { class: "star" }, "*")));
  const cards = NEW_ARRIVALS.slice(0, 3).map((book) => {
    const element = card(book);
    element.append(stars(5));
    return element;
  });
  const shelves = [
    dom.el("section", { class: "shelf" }, dom.el("h2", {}, "New"), dom.el("ul", {}, ...cards)),
    dom.el("section", { class: "shelf" }, dom.el("h2", {}, "Picks"), dom.el("ul", {}, ...STAFF_PICKS.map(card)))
  ];
  dom.el("main", {}, ...shelves);
  assert.equal(groupRecordsStart(shelves[0]!, shelves, signatureOf), cards[0]);
});

test("an order holding its lines is not a group: its own number and total are words of its own", () => {
  const line = (name: string): Element => dom.el("li", { class: "line" }, dom.el("span", { class: "l-name" }, name), dom.el("span", { class: "l-qty" }, "1"));
  const order = (number: string, total: string): Element => dom.el("article", { class: "order" },
    dom.el("h3", {}, `Order ${number}`),
    dom.el("div", { class: "o-meta" }, dom.el("span", { class: "o-date" }, "2 March"), dom.el("span", { class: "o-total" }, total)),
    dom.el("ul", {}, line("Kettle"), line("Teapot"), line("Cups")));
  const orders = [order("101", "$30.00"), order("102", "$12.50"), order("103", "$8.00")];
  dom.el("main", {}, ...orders);
  assert.equal(groupRecordsStart(orders[0]!, orders, signatureOf), undefined, "a list of orders stays the orders");
});

test("a lone group, or one among items that are not groups, is no list of groups", () => {
  const shelves = homePage();
  assert.equal(groupRecordsStart(shelves[0]!, [shelves[0]!], signatureOf), undefined, "a run of one is no run; the outward search finds its cards");
  const plain = [dom.el("section", { class: "shelf" }, dom.el("p", {}, "Opening hours")), dom.el("section", { class: "shelf" }, dom.el("p", {}, "Events"))];
  const mixed = [shelves[0]!, ...plain];
  dom.el("main", {}, ...mixed);
  assert.equal(groupRecordsStart(shelves[0]!, mixed, signatureOf), undefined, "one group in three is not a list of groups");
});

test("words of the group's own outside its heading and controls make it a record, not a group", () => {
  const shelves = [
    shelf("New at Elm Street", NEW_ARRIVALS, [dom.el("p", { class: "note" }, "Open until 8pm")]),
    shelf("Staff picks", STAFF_PICKS, [dom.el("p", { class: "note" }, "Open until 6pm")])
  ];
  dom.el("main", {}, ...shelves);
  assert.equal(groupRecordsStart(shelves[0]!, shelves, signatureOf), undefined);
});
