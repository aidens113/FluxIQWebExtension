// A control that is itself one row of a list: which runs of same-shaped
// siblings make each member its own row, and which stay page-level.
//
// The tiles are a made-up recipe gallery, not any site the Lab drives.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { el, installStubDocument, stubDocument, type StubElement } from "../../tests/stub-dom";
import { ownRun } from "../own-run";
import { agreesWithRecordedRecord, sitsInRepeatedRow } from "../record";

type Dish = { slug: string; alt: string; saves: string };

const DISHES: readonly Dish[] = [
  { slug: "lemon-tart", alt: "Lemon tart, plated on 3 May", saves: "1.2K" },
  { slug: "pea-soup", alt: "Pea soup, plated on 1 May", saves: "880" },
  { slug: "fig-bread", alt: "Fig bread, plated on 28 April", saves: "2.4K" }
];

function tile(dish: Dish): StubElement {
  return el("a", { class: "tile", href: `/r/${dish.slug}/` }, el("img", { alt: dish.alt, src: `/img/${dish.slug}.jpg` }), el("span", {}, dish.saves));
}

function install(t: TestContext, ...children: StubElement[]): void {
  const document = stubDocument();
  document.append(el("html", {}, el("body", {}, ...children)));
  installStubDocument(t, document);
}

const asElement = (element: StubElement): Element => element as unknown as Element;

test("a tile in a run of tiles is its own row, and the run is every tile in order", (t) => {
  const tiles = DISHES.map(tile);
  install(t, el("div", { class: "grid" }, el("h2", {}, "Recent"), ...tiles));
  assert.deepEqual(ownRun(asElement(tiles[1] as StubElement)), tiles);
  assert.equal(sitsInRepeatedRow(asElement(tiles[1] as StubElement)), true);
});

test("a pass's values admit their own tile and refuse the others", (t) => {
  const tiles = DISHES.map(tile);
  install(t, el("div", { class: "grid" }, ...tiles));
  const row = { values: [DISHES[2]?.alt ?? "", DISHES[2]?.saves ?? ""] };
  assert.deepEqual(tiles.map((one) => agreesWithRecordedRecord(row, asElement(one))), [false, false, true]);
});

test("a run of icon buttons, or of one-word links, is no run of rows", (t) => {
  const icon = (label: string): StubElement => el("div", { class: "icon", role: "button", "aria-label": label });
  const like = icon("Like");
  const home = el("a", { class: "menu", href: "/" }, "Home");
  install(t, el("section", {}, like, icon("Share"), icon("Save")), el("nav", {}, home, el("a", { class: "menu", href: "/explore" }, "Explore")));
  assert.equal(ownRun(asElement(like)), undefined);
  assert.equal(ownRun(asElement(home)), undefined);
  assert.equal(sitsInRepeatedRow(asElement(like)), false);
  assert.equal(sitsInRepeatedRow(asElement(home)), false);
});

test("a lone tile, tiles of another shape, and copies saying the same thing are no run", (t) => {
  const lone = tile(DISHES[0] as Dish);
  const odd = tile(DISHES[1] as Dish);
  odd.setAttribute("class", "tile wide");
  const copies = [tile(DISHES[2] as Dish), tile(DISHES[2] as Dish)];
  install(t, el("div", {}, lone), el("div", {}, tile(DISHES[0] as Dish), odd), el("div", {}, ...copies));
  assert.equal(ownRun(asElement(lone)), undefined, "alone");
  assert.equal(ownRun(asElement(odd)), undefined, "its neighbour is of another class");
  assert.equal(ownRun(asElement(copies[0] as StubElement)), undefined, "identical copies tell no row from another");
});
