// T1 coverage of the per-list way on that a passive snapshot carries
// (`../list-way-on.ts`): the read's own detectors asked about each list or
// table with nothing scrolled, on small made-up pages with a real selector
// matcher (`../../tests/selector-page.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import { listWayOn } from "../list-way-on";
import { el, page, type PageElement } from "../../tests/selector-page";

/** A reading list of three books, each with its own link, which is never a way on. */
function readingList(attributes: Record<string, string> = {}, tag = "ul"): PageElement {
  return el(tag, { class: "books", ...attributes }, ["Dune", "Emma", "Ulysses"].map((title, index) => el("li", { class: "book" }, [el("a", { href: `/book/${index}` }, title)])));
}

function wayOn(body: PageElement, container: PageElement): ReturnType<typeof listWayOn> {
  const stood = page(body);
  try {
    return listWayOn(container as unknown as Element);
  } finally {
    stood.restore();
  }
}

test("a list with an enabled Next or a following page number goes on to a next page", () => {
  const list = readingList();
  assert.equal(wayOn(el("body", {}, [el("main", {}, [list, el("nav", {}, [el("a", { href: "?page=2", rel: "next" }, "Next")])])]), list), "next_page");
  const numbered = readingList();
  const pager = el("nav", {}, [el("span", { "aria-current": "page" }, "1"), el("a", { href: "?page=2" }, "2")]);
  assert.equal(wayOn(el("body", {}, [el("main", {}, [numbered, pager])]), numbered), "next_page");
});

test("a list with an enabled Load more goes on by loading more; a spent one has ended", () => {
  const open = readingList();
  assert.equal(wayOn(el("body", {}, [el("main", {}, [open, el("button", { class: "more" }, "Load more")])]), open), "load_more");
  const spent = readingList();
  assert.equal(wayOn(el("body", {}, [el("main", {}, [spent, el("button", { class: "more", disabled: "" }, "Load more")])]), spent), "none");
});

test("a list the page declares a feed is a feed, though nothing was scrolled", () => {
  const feed = readingList({ role: "feed" });
  const inner = readingList();
  assert.equal(wayOn(el("body", {}, [el("main", { role: "feed" }, [inner])]), inner), "feed");
  const rows = readingList({ "aria-rowcount": "40" });
  assert.equal(wayOn(el("body", {}, [el("main", {}, [rows])]), rows), "feed");
  // A container whose own role is feed is not a list, so it says nothing.
  assert.equal(wayOn(el("body", {}, [el("main", {}, [feed])]), feed), undefined);
});

test("a list with no way on, and one whose pager is on its last page, say none", () => {
  const list = readingList({}, "ol");
  assert.equal(wayOn(el("body", {}, [el("main", {}, [el("h2", {}, "Reading list"), list])]), list), "none");
  const last = readingList();
  const pager = el("nav", {}, [el("a", { href: "?page=1" }, "Previous"), el("span", { "aria-disabled": "true" }, "Next")]);
  assert.equal(wayOn(el("body", {}, [el("main", {}, [last, pager])]), last), "none");
  const aria = el("div", { role: "list" }, [el("div", { role: "listitem" }, "Dune"), el("div", { role: "listitem" }, "Emma")]);
  assert.equal(wayOn(el("body", {}, [el("main", {}, [aria])]), aria), "none");
});

test("a table is read by its body rows, less its header rows; a table of only headers says nothing", () => {
  const recipes = el("table", {}, [
    el("thead", {}, [el("tr", {}, [el("th", {}, "Recipe"), el("th", {}, "Minutes")])]),
    el("tbody", {}, ["Soup", "Bread"].map((name) => el("tr", {}, [el("td", {}, name), el("td", {}, "30")])))
  ]);
  assert.equal(wayOn(el("body", {}, [el("main", {}, [recipes])]), recipes), "none");
  const paged = el("table", {}, [el("tbody", {}, [el("tr", {}, [el("td", {}, "Soup")])])]);
  assert.equal(wayOn(el("body", {}, [el("main", {}, [paged, el("button", {}, "Show more")])]), paged), "load_more");
  const headers = el("table", {}, [el("tr", {}, [el("th", {}, "Recipe"), el("th", {}, "Minutes")])]);
  assert.equal(wayOn(el("body", {}, [el("main", {}, [headers])]), headers), undefined);
});

test("an element that is no list or table, a list with no item, and a list dressed as a menu say nothing", () => {
  const section = el("section", {}, [el("p", {}, "Nothing listed")]);
  const empty = el("ul", {}, []);
  const menu = readingList({ role: "menu" });
  for (const container of [section, empty, menu]) assert.equal(wayOn(el("body", {}, [el("main", {}, [container])]), container), undefined);
});

test("a nested list's items are its own: the outer list ends though the inner one has a Load more", () => {
  const inner = readingList();
  const outer = el("ul", {}, [el("li", {}, [el("span", {}, "Shelf"), inner, el("button", {}, "Load more")]), el("li", {}, "Second shelf")]);
  const body = el("body", {}, [el("main", {}, [outer])]);
  assert.equal(wayOn(body, inner), "load_more");
  // The Load more sits inside the outer list's own item, which is never a way on for it.
  assert.equal(wayOn(body, outer), "none");
});
