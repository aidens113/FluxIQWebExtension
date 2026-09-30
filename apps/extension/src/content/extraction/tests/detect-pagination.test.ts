// T1 coverage of which control a label names, the pure half of pagination
// detection. Where the controls are looked for, and that a card's own link is
// never one, needs a document and is proven on real fixtures by
// `e2e/content/tests/extraction/inference.spec.ts`.

import assert from "node:assert/strict";
import test from "node:test";
import { nextControlOnPage, PROPOSED_MAX_PAGES, paginationKindForLabel } from "../detect-pagination";
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
