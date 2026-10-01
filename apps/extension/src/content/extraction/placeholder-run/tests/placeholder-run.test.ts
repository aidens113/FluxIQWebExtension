// T1 coverage of the skeleton cards a structure detection waits for
// (`placeholder-run.ts`, read by `detect-structure.ts` `settled`). On the Spain
// hubs' results the grid is nineteen empty skeletons for 600 ms after load, and
// a detection then answered the sidebar's five filter groups as final (t194
// G3). That the detection waits, and then answers the results, is proven on the
// fixture itself by `e2e/content/tests/live-tasks/tests/crossborder-marketplace-spain-hubs.spec.ts`;
// these are the rule's own cases, on small pages.

import assert from "node:assert/strict";
import test from "node:test";
import { largestPlaceholderRunApartFrom } from "../placeholder-run";
import { asElements, el, page, type PageElement } from "../../tests/selector-page";

const skeletons = (count: number): PageElement[] => Array.from({ length: count }, () => el("div", { class: "skeleton" }));
const filterGroups = (): PageElement[] => ["Category", "Brand", "Price", "Rating", "Shipping"].map((title) => el("div", { class: "filterGroup" }, [el("h3", {}, title), el("a", { href: "#" }, "Any")]));
const cards = (count: number): PageElement[] => Array.from({ length: count }, (_, index) => el("div", { class: "card" }, [el("a", { href: `/item/${index}` }, `Hub ${index}`)]));

function measured(body: PageElement, items: readonly PageElement[]): number {
  const stood = page(body);
  try {
    return largestPlaceholderRunApartFrom(asElements(items), body as unknown as Element);
  } finally {
    stood.restore();
  }
}

test("while the results are skeletons, the sidebar's filter groups stand beside a larger list being drawn", () => {
  const groups = filterGroups();
  const body = el("body", {}, [el("aside", { class: "sidebar" }, groups), el("div", { class: "grid" }, skeletons(19))]);
  assert.equal(measured(body, groups), 19);
});

test("a grid whose first cards are drawn and whose last are still skeletons is the detected list filling in", () => {
  const drawn = cards(10);
  const body = el("body", {}, [el("aside", { class: "sidebar" }, filterGroups()), el("div", { class: "grid" }, [...drawn, ...skeletons(9)])]);
  assert.equal(measured(body, drawn), 0);
});

test("empty decorations inside the detected items are the items' own, not another list", () => {
  const rated = Array.from({ length: 3 }, (_, index) => el("li", { class: "card" }, [el("a", { href: `/item/${index}` }, `Item ${index}`), el("div", { class: "stars" }, Array.from({ length: 5 }, () => el("div", { class: "star" })))]));
  const body = el("body", {}, [el("ul", {}, rated)]);
  assert.equal(measured(body, rated), 0);
  assert.equal(measured(body, []), 5, "and the same stars, seen from outside the cards, are a run");
});

test("an element holding a word or an element is not a placeholder, an empty span is an icon, and two are not a run", () => {
  const body = el("body", {}, [
    el("div", {}, [el("div", { class: "cell" }, "1"), el("div", { class: "cell" }, "2"), el("div", { class: "cell" }, "3")]),
    el("div", {}, [el("div", { class: "box" }, [el("img", {})]), el("div", { class: "box" }, [el("img", {})]), el("div", { class: "box" }, [el("img", {})])]),
    el("p", {}, [el("span", { class: "icon" }), el("span", { class: "icon" }), el("span", { class: "icon" })]),
    el("div", {}, skeletons(2))
  ]);
  assert.equal(measured(body, []), 0);
});

test("placeholders of different templates under one parent are runs of their own", () => {
  const body = el("body", {}, [el("div", {}, [...skeletons(4), el("div", { class: "spacer" }), el("div", { class: "spacer" }), el("div", { class: "spacer" })])]);
  assert.equal(measured(body, []), 4);
});
