// A grid of grouped controls read one row per control (`../cell-run.ts`, t885
// R2): which controls are a grid's cells (`../grid-cells.ts`), the columns
// each row carries (`../cell-fields.ts`), and the read that keeps "the free
// showings on Saturday" by its group's heading and its disabled state, the
// page and Core's condition judge agreeing.
//
// The page is the Node stub `../../tests/fake-shadow-dom.ts`. The fixture is a
// cinema's showings per day, never a booking calendar.

import assert from "node:assert/strict";
import test from "node:test";
import {
  webAutomationExtractConditionHolds,
  webAutomationExtractListRequestValue,
  type WebAutomationExtractField,
  type WebAutomationExtractionProposal
} from "@fluxiq-web-extension/domain/client";
import { readField } from "../../field-reader";
import { normalizeExtractField } from "../../field-spec";
import { inferFields } from "../../infer-fields";
import { itemFilterFor } from "../../item-filter";
import { fakeShadowDom } from "../../tests/fake-shadow-dom";
import { cellFields } from "../cell-fields";
import { gridCells } from "../grid-cells";

const dom = fakeShadowDom();

type Showing = { time: string; free: boolean };

/** One day's column: its heading, then a showing per time, or a note where it has none. */
function day(heading: string, date: string, showings: Showing[]): Element {
  const inner = showings.length === 0
    ? [dom.el("div", { class: "note" }, "No showings")]
    : showings.map(({ time, free }) => dom.el("div", { class: "time", role: "button", "aria-disabled": String(!free), "data-date": date }, time));
  return dom.el("div", { class: "day" }, dom.el("div", { class: "head" }, heading), ...inner);
}

/** Four days of showings, the first with none; Saturday has one sold out and one free. */
function week(): Element[] {
  const days = [
    day("Fri 02/10", "2026-10-02", []),
    day("Sat 03/10", "2026-10-03", [{ time: "14:00", free: false }, { time: "17:00", free: true }]),
    day("Sun 04/10", "2026-10-04", [{ time: "14:00", free: true }, { time: "17:00", free: true }]),
    day("Mon 05/10", "2026-10-05", [{ time: "17:00", free: false }, { time: "20:00", free: true }])
  ];
  dom.el("div", { class: "week" }, ...days);
  return days;
}

/** The days as detection proposes them: one row per day. */
function dayRun(days: readonly Element[]): WebAutomationExtractionProposal {
  return { container: "div.week", item: "div.week > div.day", itemCount: days.length, fields: inferFields(days[0]!, days), confidence: 0.5 };
}

/** Each cell's record as the page reads it. */
function records(cells: readonly Element[], fields: Record<string, WebAutomationExtractField>): Array<Record<string, string | null>> {
  return cells.map((cell) => Object.fromEntries(Object.entries(fields).map(([key, field]) => {
    const reader = normalizeExtractField(key, field);
    return [key, reader === undefined ? null : readField(cell, key, reader) ?? null];
  })));
}

test("the showings of every day are the grid's cells, in page order", () => {
  const days = week();
  const cells = gridCells(days);
  assert.deepEqual(cells?.map((cell) => cell.textContent), ["14:00", "17:00", "14:00", "17:00", "17:00", "20:00"]);
});

test("a card list whose cards each hold the same Like and Share, or one button each, is no grid", () => {
  const cards = ["Garden notes", "Rain gauge", "Seed swap"].map((title) => dom.el("article", { class: "card" },
    dom.el("h3", {}, title), dom.el("div", { class: "actions" }, dom.el("button", {}, "Like"), dom.el("button", {}, "Share"))));
  dom.el("div", { class: "feed" }, ...cards);
  assert.equal(gridCells(cards), undefined, "the same words in every card are the card's chrome");
  const products = ["Kettle", "Toaster", "Mixer"].map((title) => dom.el("li", {}, dom.el("span", {}, title), dom.el("button", {}, `Add ${title}`)));
  dom.el("ul", {}, ...products);
  assert.equal(gridCells(products), undefined, "one control per item is the item's own, not a grid");
});

type Tool = { name: string; price: string; rating: string; pickup: string; sizes: boolean };

/**
 * One rental listing as a results grid draws it (t1020): the card's own title link first, then the
 * picture, the price, the name again as text, the rating and the pickup line, and last its one
 * action -- a Sizes link where the tool comes in several sizes, a Reserve button otherwise. Both
 * links sit straight in the card, so the card with Sizes holds two links side by side.
 */
function toolCard({ name, price, rating, pickup, sizes }: Tool, index: number): Element {
  const href = `/tools/${index}`;
  const action = sizes ? dom.el("a", { class: "sizes", href }, "Sizes") : dom.el("button", { class: "reserve" }, "Reserve");
  return dom.el("div", { class: "tile", "data-item-id": String(100 + index) },
    dom.el("a", { class: "tile-link", href }, dom.el("span", { class: "sr" }, name)),
    dom.el("div", { class: "pic" }, dom.el("img", { src: `/img/${index}.svg`, alt: name })),
    dom.el("div", { class: "price" }, dom.el("span", { class: "sr" }, price)),
    dom.el("span", { class: "title" }, name),
    dom.el("div", { class: "rating" }, dom.el("span", { class: "value" }, rating)),
    dom.el("div", { class: "pickup" }, dom.el("div", { class: "line" }, pickup)),
    action);
}

function toolGrid(): Element[] {
  const tools: Tool[] = [
    { name: "Orbital sander", price: "$12.00", rating: "4.6", pickup: "Pickup today", sizes: true },
    { name: "Tile cutter", price: "$18.50", rating: "4.1", pickup: "Pickup tomorrow", sizes: false },
    { name: "Post hole digger", price: "$9.75", rating: "4.8", pickup: "Pickup today", sizes: false },
    { name: "Pressure washer", price: "$31.00", rating: "4.4", pickup: "Pickup today", sizes: false },
    { name: "Wet vacuum", price: "$14.25", rating: "4.7", pickup: "Pickup tomorrow", sizes: false }
  ];
  const cards = tools.map(toolCard);
  dom.el("section", { class: "results" }, dom.el("div", { class: "grid" }, ...cards));
  return cards;
}

test("cards that each hold their own link, one card a second link beside it, are no grid: one link per card is the card's own (t1020)", () => {
  const cards = toolGrid();
  assert.equal(gridCells(cards), undefined, "a second link in one card of five is that card's exception, not a grid's rule");
});

test("those cards read as the run, one row per card carrying its link, price, rating and pickup line (t1020)", () => {
  const cards = toolGrid();
  const fields = inferFields(cards[0]!, cards);
  const stored = records(cards, Object.fromEntries(fields.map((field) => [field.key, field.spec as WebAutomationExtractField])));
  assert.equal(stored.length, cards.length, "one row per card");
  // The fake page resolves no link address, so the card's link is proven as its column; a browser reads its href.
  assert.ok(fields.some((field) => field.spec.kind === "link"), "the card's own link is a column of its row");
  const wanted: Array<[number, string[]]> = [[0, ["$12.00", "4.6", "Pickup today", "Orbital sander"]], [2, ["$9.75", "4.8", "Pickup today", "Post hole digger"]]];
  for (const [index, values] of wanted) {
    const row = Object.values(stored[index]!);
    for (const value of values) assert.ok(row.some((cell) => cell?.includes(value) === true), `card ${index} carries ${value} in its one row: ${JSON.stringify(stored[index])}`);
  }
});

test("days that hold one showing each but one are no grid, and days that mostly repeat still are", () => {
  const sparse = [
    day("Fri 02/10", "2026-10-02", [{ time: "14:00", free: true }]),
    day("Sat 03/10", "2026-10-03", [{ time: "15:00", free: true }]),
    day("Sun 04/10", "2026-10-04", [{ time: "16:00", free: true }, { time: "19:00", free: true }]),
    day("Mon 05/10", "2026-10-05", [{ time: "17:00", free: true }])
  ];
  dom.el("div", { class: "week" }, ...sparse);
  assert.equal(gridCells(sparse), undefined, "one of four days repeating is not a timetable");
  const mostly = [
    day("Fri 02/10", "2026-10-02", [{ time: "14:00", free: true }]),
    day("Sat 03/10", "2026-10-03", [{ time: "14:00", free: true }, { time: "17:00", free: true }]),
    day("Sun 04/10", "2026-10-04", [{ time: "16:00", free: true }, { time: "19:00", free: true }])
  ];
  dom.el("div", { class: "week" }, ...mostly);
  assert.equal(gridCells(mostly)?.length, 5, "two of three days repeating is");
});

test("each cell carries its day's heading read in its group, its own words, its date and its disabled state", () => {
  const days = week();
  const cells = gridCells(days)!;
  const fields = cellFields(days, cells, dayRun(days));
  const byLabel = new Map(fields.map((field) => [field.label, field]));
  assert.deepEqual([...byLabel.keys()].sort(), ["data-date", "group heading", "item", "item (disabled)"]);
  const heading = byLabel.get("group heading")!;
  assert.deepEqual([heading.spec.group, heading.spec.kind, heading.coverage], ["div.week > div.day", "text", 1]);
  assert.equal(byLabel.get("item (disabled)")!.spec.mark, "state");
  const stored = records(cells, Object.fromEntries(fields.map((field) => [field.key, field.spec as WebAutomationExtractField])));
  assert.deepEqual(stored.map((row) => [row[heading.key], row.item]), [
    ["Sat 03/10", "14:00"], ["Sat 03/10", "17:00"], ["Sun 04/10", "14:00"], ["Sun 04/10", "17:00"], ["Mon 05/10", "17:00"], ["Mon 05/10", "20:00"]
  ]);
});

test("where the heading says Saturday and the disabled state is absent keeps Saturday's free showing, on the page and in Core alike", () => {
  const days = week();
  const cells = gridCells(days)!;
  const proposed = cellFields(days, cells, dayRun(days));
  const fields = Object.fromEntries(proposed.map((field) => [field.key, field.spec as WebAutomationExtractField]));
  const heading = proposed.find((field) => field.label === "group heading")!.key;
  const disabled = proposed.find((field) => field.label === "item (disabled)")!.key;
  const request = webAutomationExtractListRequestValue({ item: "div.week div.time", fields, where: [{ field: heading, contains: "Sat" }, { field: disabled, is: "absent" }] });
  assert.ok(request, "the domain reads a request whose heading column is read in the group");
  const stored = records(cells, fields);
  const filter = itemFilterFor(request)!;
  const onPage = cells.map((cell, index) => filter(cell, stored[index]!).length === 0);
  const inCore = stored.map((row) => request.where!.every((condition) => webAutomationExtractConditionHolds(condition, row[condition.field!] ?? undefined)));
  assert.deepEqual(onPage, inCore, "the page and Core agree");
  assert.deepEqual(stored.filter((_, index) => onPage[index]).map((row) => [row["data-date"], row.item]), [["2026-10-03", "17:00"]]);
});
