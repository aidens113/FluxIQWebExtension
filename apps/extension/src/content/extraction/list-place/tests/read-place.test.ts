// T1 coverage of the place a read of one page was at, as its pager says it, on small
// made-up pages (a cinema's listings, a timetable) with the real selector matcher.

import assert from "node:assert/strict";
import test from "node:test";
import { grewByAppending, readPlace } from "../index";
import { asElements, el, page, PageElement } from "../../tests/selector-page";

// The made-up page has no `:disabled`, which the pager reading asks of a following control; none of these controls is disabled.
const matches = PageElement.prototype.matches;
PageElement.prototype.matches = function (this: PageElement, selector: string): boolean {
  return selector === ":disabled" ? false : matches.call(this, selector);
};

const BASE = "http://page.test/results";

function listings(count = 4): { list: PageElement; rows: PageElement[] } {
  const rows = Array.from({ length: count }, (_, index) => el("li", { class: "showing" }, `Showing ${index + 1}`));
  return { list: el("ul", { class: "showings" }, rows), rows };
}

function placeOn(body: PageElement, rows: PageElement[], url: string, extra: { appended?: boolean; firstReturned?: number } = {}) {
  const stood = page(body);
  stood.document.URL = url;
  try {
    return readPlace({ item: "li.showing", run: asElements(rows), listContinues: "load_more", itemsAtStart: extra.appended ? asElements(rows.slice(0, 2)) : asElements(rows), whole: true, firstReturned: extra.firstReturned });
  } finally {
    stood.restore();
  }
}

const numbered = (current: number) => el("nav", { class: "pages" }, [1, 2, 3, 4].map((number) => number === current
  ? el("span", { class: "pageLink", "aria-current": "page" }, String(number))
  : el("a", { class: "pageLink", href: `${BASE}?page=${number}` }, String(number))));

test("a numbered pager's current page is the place", () => {
  const { list, rows } = listings();
  assert.deepEqual(placeOn(el("body", {}, [el("main", {}, [list, numbered(3)])]), rows, `${BASE}?page=3`), { kind: "page", value: 3 });
});

test("a next-link pager with a page parameter says the page from the address", () => {
  const { list, rows } = listings();
  const body = el("body", {}, [el("main", {}, [list, el("nav", {}, [el("a", { href: `${BASE}?page=3`, rel: "next" }, "Next")])])]);
  assert.deepEqual(placeOn(body, rows, `${BASE}?page=2`), { kind: "page", value: 2 });
});

test("a next-link pager with a cursor parameter says the cursor from the address", () => {
  const { list, rows } = listings();
  const body = el("body", {}, [el("main", {}, [list, el("nav", {}, [el("a", { href: `${BASE}?cursor=zz9`, rel: "next" }, "Next")])])]);
  assert.deepEqual(placeOn(body, rows, `${BASE}?cursor=abc_12`), { kind: "cursor", value: "abc_12" });
});

test("a Load more list that grew by appending says the offset of the first item returned", () => {
  const { list, rows } = listings(6);
  const body = el("body", {}, [el("main", {}, [list, el("button", { class: "more" }, "Load more")])]);
  assert.deepEqual(placeOn(body, rows, BASE, { appended: true, firstReturned: 2 }), { kind: "offset", value: 2 });
});

test("a Load more list that did not grow by appending says nothing", () => {
  const { list, rows } = listings(6);
  const body = el("body", {}, [el("main", {}, [list, el("button", { class: "more" }, "Load more")])]);
  assert.equal(placeOn(body, rows, BASE, { appended: false, firstReturned: 0 }), undefined);
});

test("a pager that says nothing sends no place, and an address parameter no pager control uses is not one", () => {
  const { list, rows } = listings();
  assert.equal(placeOn(el("body", {}, [el("main", {}, [list])]), rows, `${BASE}?page=4`), undefined);
  const next = el("body", {}, [el("main", {}, [list, el("nav", {}, [el("a", { href: `${BASE}?screen=2`, rel: "next" }, "Next")])])]);
  assert.equal(placeOn(next, rows, `${BASE}?page=4&screen=2`), undefined);
});

test("a value that is not a clean page, offset or cursor is not sent", () => {
  const next = (name: string, value: string) => {
    const { list, rows } = listings();
    const body = el("body", {}, [el("main", {}, [list, el("nav", {}, [el("a", { href: `${BASE}?${name}=9`, rel: "next" }, "Next")])])]);
    return placeOn(body, rows, `${BASE}?${name}=${encodeURIComponent(value)}`);
  };
  assert.equal(next("page", "0"), undefined);
  assert.equal(next("page", "2 of 9"), undefined);
  assert.equal(next("page", "-1"), undefined);
  assert.equal(next("cursor", "two words"), undefined);
  assert.equal(next("cursor", "x".repeat(200)), undefined);
  assert.equal(next("offset", "1e3"), undefined);
  assert.deepEqual(next("offset", "40"), { kind: "offset", value: 40 });
});

test("growth by appending needs the earlier items kept in place with more after them", () => {
  const { list, rows } = listings(4);
  const stood = page(el("body", {}, [el("main", {}, [list])]));
  try {
    const before = asElements(rows.slice(0, 2));
    assert.equal(grewByAppending(before, asElements(rows)), true);
    assert.equal(grewByAppending(before, before), false);
    assert.equal(grewByAppending(before, asElements([rows[1]!, rows[0]!, rows[2]!])), false);
    assert.equal(grewByAppending([], asElements(rows)), false);
  } finally {
    stood.restore();
  }
});
