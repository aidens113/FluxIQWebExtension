// T1 coverage of which control a label names, the pure half of pagination
// detection. Where the controls are looked for, and that a card's own link is
// never one, needs a document and is proven on real fixtures by
// `e2e/content/tests/extraction/inference.spec.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { detectPagination, nextControlOnPage, PROPOSED_MAX_PAGES, paginationKindForLabel } from "../detect-pagination";
import { el as pageEl, asElements as pageElements, page, type PageElement } from "./selector-page";
import { FakeElement } from "./store-pager";

test("a control labelled Next follows the list, however the page cases or decorates it", () => {
  for (const label of ["Next", "next", " Next \n", "Next page", "NEXT PAGE", "Go to next page", "Next →"]) {
    assert.equal(paginationKindForLabel(label, undefined), "next", label);
  }
});

test("rel=next says so even when the label does not", () => {
  assert.equal(paginationKindForLabel("›", "next"), "next");
  assert.equal(paginationKindForLabel("›", "nofollow next"), "next");
  assert.equal(paginationKindForLabel("›", "nextish"), undefined);
});

test("Load more and Show more append to the list rather than replacing it", () => {
  for (const label of ["Load more", "Show more", "Load More Products", "View more results"]) {
    assert.equal(paginationKindForLabel(label, undefined), "loadMore", label);
  }
});

test("a control that says nothing about pagination is not one", () => {
  for (const label of ["", "   ", "Previous", "1", "Add to cart", "More about us"]) {
    assert.equal(paginationKindForLabel(label, undefined), undefined, JSON.stringify(label));
  }
});

// A proposal says how a list continues. How much of it to take is what the
// instruction says, and a detector that answers it too turns "the first page"
// into "every page" without anyone choosing. On 2026-09-24 that cost two of the
// three live runs that completed: each built a single `web.dom.extract_list`
// carrying this proposal, walked all three catalog pages, and returned 23
// records where the expectation held 8 -- with every in-scope record matching
// field for field, so nothing else was wrong. A read that wants more pages now
// has to say so, and one stopped by this bound reports `truncated` rather than
// quietly answering short.
test("a proposal asks for the page in front of it, never for every page the pager shows", () => {
  assert.equal(PROPOSED_MAX_PAGES, 1);
});

// And which control a `next` read follows on the page it is on
// (`nextControlOnPage`): the authored one unless it names nothing or plainly
// another page's control, then the pager's own. The store-shaped pager and
// the page advance it drives are in `pagination.test.ts`; these are the rules
// on their own, on small trees.

/** Runs `body` with the one browser name the label reader asks about defined. */
function withElementNames<T>(body: () => T): T {
  const saved = (globalThis as Record<string, unknown>).HTMLInputElement;
  (globalThis as Record<string, unknown>).HTMLInputElement = class {};
  try {
    return body();
  } finally {
    (globalThis as Record<string, unknown>).HTMLInputElement = saved;
  }
}

const el = (tag: string, attributes: Record<string, string> = {}, text = "", children: FakeElement[] = []) => new FakeElement(tag, attributes, text, children);
const asElements = (items: FakeElement[]) => items as unknown as Element[];

test("an authored control whose label says nothing a pager says -- an icon -- is the author's choice and is followed", () => withElementNames(() => {
  const icon = el("button", {}, "›");
  const items = [el("li", {}, "one"), el("li", {}, "two")];
  el("div", {}, "", [el("ul", {}, "", items), el("div", {}, "", [icon, el("a", { href: "/p/2", "aria-label": "Next page" }, "Next")])]);
  assert.deepEqual(nextControlOnPage(icon as unknown as Element, asElements(items)), { control: icon, by: "selector" });
}));

test("a list's own item links are never its Next, and only a label that is the pager's Next replaces the author's choice", () => withElementNames(() => {
  const items = [el("li", {}, "", [el("a", { href: "/p/next" }, "Next")]), el("li", {}, "", [el("a", { href: "/deliver" }, "Next day delivery")])];
  const list = el("ul", {}, "", items);
  const slide = el("button", {}, "Next slide");
  const next = el("a", { href: "/list?page=2" }, "Next ›");
  el("section", {}, "", [list, el("div", {}, "", [slide]), el("nav", {}, "", [next])]);
  assert.deepEqual(nextControlOnPage(null, asElements(items)), { control: next, by: "label" });
}));

test("rel=next is the pager's Next whatever it reads", () => withElementNames(() => {
  const items = [el("li", {}, "one")];
  const next = el("a", { href: "/list?page=2", rel: "next" }, "»");
  el("div", {}, "", [el("ul", {}, "", items), el("nav", {}, "", [next])]);
  assert.deepEqual(nextControlOnPage(null, asElements(items)), { control: next, by: "label" });
}));

test("a pager that labels no Next is followed by the page number after the one marked current", () => withElementNames(() => {
  const items = [el("li", {}, "one"), el("li", {}, "two")];
  const three = el("a", { href: "/list?page=3" }, "3");
  const drifted = el("a", { href: "/list?page=1" }, "1");
  el("div", {}, "", [el("ul", {}, "", items), el("nav", {}, "", [drifted, el("span", { "aria-current": "page" }, "2"), three])]);
  // The authored selector drifted onto page one's number: plainly another page.
  assert.deepEqual(nextControlOnPage(drifted as unknown as Element, asElements(items)), { control: three, by: "number" });
}));

test("an authored control that names another page, where the pager offers no way on, is no way on", () => withElementNames(() => {
  const items = [el("li", {}, "one")];
  const previous = el("a", { href: "/list?page=4", "aria-label": "Go to previous page, page 4" }, "Previous");
  el("div", {}, "", [el("ul", {}, "", items), el("nav", {}, "", [previous, el("span", { "aria-current": "page" }, "5")])]);
  assert.equal(nextControlOnPage(previous as unknown as Element, asElements(items)), undefined);
}));

// And what detection proposes for a numbered pager, on small pages with a real
// selector matcher (`selector-page.ts`). Both t194 fixtures drew pagers it
// proposed as no pagination at all: the current page carries one class more
// than the others, and the links sit in a pager element of their own beside the
// list, below the level where the walk outward first meets them (G2, G4).

/** Four result cards in a list, each with its own link, which is never a pager's. */
function results(): { list: PageElement; cards: PageElement[] } {
  const cards = [1, 2, 3, 4].map((index) => pageEl("li", { class: "card" }, [pageEl("a", { href: `/item/${index}` }, `Item ${index}`)]));
  return { list: pageEl("ul", { class: "results" }, cards), cards };
}

/** What `selector` names on the page standing now. */
function named(selector: string): unknown[] {
  return (document.querySelectorAll(selector) as unknown as unknown[]).slice();
}

function proposedOn(cards: PageElement[], list: PageElement): ReturnType<typeof detectPagination> {
  return detectPagination(pageElements(cards), list as unknown as Element);
}

test("a numbered pager in its own nav, its current page styled apart and Next an arrow labelled otherwise, is proposed as numbered pages naming every number", () => {
  const { list, cards } = results();
  const numbers = [
    pageEl("a", { class: "pageLink pageCurrent", href: "?_pgn=1", "aria-current": "page" }, "1"),
    pageEl("a", { class: "pageLink", href: "?_pgn=2" }, "2"),
    pageEl("a", { class: "pageLink", href: "?_pgn=3" }, "3")
  ];
  const nav = pageEl("nav", { class: "pagination", "aria-label": "Results pagination" }, [
    pageEl("span", { class: "pageArrow", "aria-disabled": "true" }, "‹"),
    ...numbers,
    pageEl("a", { class: "pageArrow", href: "?_pgn=2", "aria-label": "Go to next search page" }, "›"),
    pageEl("label", {}, [pageEl("select", { "aria-label": "Items per page" })])
  ]);
  const body = pageEl("body", {}, [pageEl("main", {}, [pageEl("section", {}, [list]), nav])]);
  const stood = page(body);
  try {
    const proposal = proposedOn(cards, list);
    assert.equal(proposal?.mode, "numbered", JSON.stringify(proposal));
    const pages = (proposal as { pages: string }).pages;
    assert.equal(pages, "main > nav > a.pageLink");
    assert.deepEqual(named(pages), numbers, "every number, the current page included, and neither arrow");
    assert.equal(proposal?.maxPages, PROPOSED_MAX_PAGES);
  } finally {
    stood.restore();
  }
});

test("a pager whose Next is a plain div and whose numbers carry no aria-current is named by the class the numbers share", () => {
  const { list, cards } = results();
  const numbers = [
    pageEl("a", { class: "pagerItem pagerCurrent", href: "/search?page=1" }, "1"),
    pageEl("a", { class: "pagerItem", href: "/search?page=2" }, "2"),
    pageEl("a", { class: "pagerItem", href: "/search?page=3" }, "3")
  ];
  const pager = pageEl("div", { class: "pager" }, [
    pageEl("div", { class: "pagerItem pagerDisabled" }, "‹ Previous"),
    ...numbers,
    pageEl("div", { class: "pagerItem" }, "Next ›"),
    pageEl("span", { class: "pagerJump" }, [pageEl("input", { class: "priceInput" }), pageEl("span", { class: "btn" }, "Go")])
  ]);
  const sidebar = pageEl("aside", { class: "sidebar" }, [pageEl("a", { href: "/search?cat=hubs" }, "USB hubs")]);
  const body = pageEl("body", {}, [pageEl("div", { class: "layout" }, [sidebar, pageEl("div", { class: "content" }, [pageEl("div", { class: "grid" }, [list]), pager])])]);
  const stood = page(body);
  try {
    const proposal = proposedOn(cards, list);
    assert.equal(proposal?.mode, "numbered", JSON.stringify(proposal));
    assert.deepEqual(named((proposal as { pages: string }).pages), numbers);
  } finally {
    stood.restore();
  }
});

test("numbers that each sit alone in a list item are named through the item", () => {
  const { list, cards } = results();
  const numbers = [
    pageEl("a", { class: "page active", href: "?p=1", "aria-current": "page" }, "1"),
    pageEl("a", { class: "page", href: "?p=2" }, "2"),
    pageEl("a", { class: "page", href: "?p=3" }, "3")
  ];
  const pager = pageEl("ul", { class: "pagination" }, [...numbers.map((number) => pageEl("li", {}, [number])), pageEl("li", {}, [pageEl("span", {}, "…")])]);
  const body = pageEl("body", {}, [pageEl("main", {}, [list, pageEl("div", { class: "footer" }, [pager])])]);
  const stood = page(body);
  try {
    const proposal = proposedOn(cards, list);
    assert.equal(proposal?.mode, "numbered", JSON.stringify(proposal));
    const pages = (proposal as { pages: string }).pages;
    assert.match(pages, / > li > a\.page$/u);
    assert.deepEqual(named(pages), numbers);
  } finally {
    stood.restore();
  }
});

test("a list with a pager above it and one below is named by the one above, never by both at once", () => {
  const { list, cards } = results();
  const pagerOf = () => pageEl("nav", {}, [
    pageEl("a", { class: "num current", href: "?p=1", "aria-current": "page" }, "1"),
    pageEl("a", { class: "num", href: "?p=2" }, "2"),
    pageEl("a", { class: "num", href: "?p=3" }, "3")
  ]);
  const top = pagerOf();
  const body = pageEl("body", {}, [pageEl("main", {}, [top, list, pagerOf()])]);
  const stood = page(body);
  try {
    const proposal = proposedOn(cards, list);
    assert.equal(proposal?.mode, "numbered", JSON.stringify(proposal));
    assert.deepEqual(named((proposal as { pages: string }).pages), top.children);
  } finally {
    stood.restore();
  }
});

// Where the page offers a Next as well as numbers, Next is what reads every
// page: the numbers a pager draws are a window, and a Next leading back to its
// own page is already read through the pager's following number
// (`pagination.ts`). This guards the choice; it held before t194 too.
test("a pager offering a labelled Next beside its numbers is proposed as Next", () => {
  const { list, cards } = results();
  const next = pageEl("a", { class: "pageLink", href: "?p=2", rel: "next" }, "Next");
  const nav = pageEl("nav", {}, [
    pageEl("a", { class: "pageLink current", href: "?p=1", "aria-current": "page" }, "1"),
    pageEl("a", { class: "pageLink", href: "?p=2" }, "2"),
    pageEl("a", { class: "pageLink", href: "?p=3" }, "3"),
    next
  ]);
  const body = pageEl("body", {}, [pageEl("main", {}, [list, nav])]);
  const stood = page(body);
  try {
    const proposal = proposedOn(cards, list);
    assert.equal(proposal?.mode, "next", JSON.stringify(proposal));
    assert.deepEqual(named((proposal as { next: string }).next), [next]);
  } finally {
    stood.restore();
  }
});
