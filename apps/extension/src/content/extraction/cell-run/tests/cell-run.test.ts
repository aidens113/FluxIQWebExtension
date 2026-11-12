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
