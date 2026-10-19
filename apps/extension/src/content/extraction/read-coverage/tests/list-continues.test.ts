// T1 coverage of whether a read of one page saw its list go on past it: the
// reader's own detection (`../../detect-pagination.ts`, `../../feed-signal.ts`)
// asked about the list the read just read, on small made-up pages with a real
// selector matcher (`../../tests/selector-page.ts`). A way on that is there and
// enabled says the list continues; a disabled one, or none, says it ended.

import assert from "node:assert/strict";
import test from "node:test";
import { listContinuesPast } from "../list-continues";
import { asElements, el, page, type PageElement } from "../../tests/selector-page";

/** Four recipe cards in a list, each with its own link, which is never a way on. */
function recipes(listAttributes: Record<string, string> = {}): { list: PageElement; cards: PageElement[] } {
  const cards = [1, 2, 3, 4].map((index) => el("li", { class: "recipe" }, [el("a", { href: `/recipe/${index}` }, `Recipe ${index}`)]));
  return { list: el("ul", { class: "recipes", ...listAttributes }, cards), cards };
}

function on<T>(body: PageElement, read: () => T): T {
  const stood = page(body);
  try {
    return read();
  } finally {
    stood.restore();
  }
}

test("an enabled Next beside the list says it continues to a next page", () => {
  const { list, cards } = recipes();
  const body = el("body", {}, [el("main", {}, [list, el("nav", {}, [el("a", { href: "?page=2", rel: "next" }, "Next")])])]);
  assert.deepEqual(on(body, () => listContinuesPast(asElements(cards))), { kind: "next_page", evidence: "next_control" });
});

test("a Next drawn disabled, as a pager draws it on its last page, says the list ended", () => {
  const { list, cards } = recipes();
  const body = el("body", {}, [el("main", {}, [list, el("nav", {}, [el("a", { href: "?page=3" }, "Previous"), el("span", { "aria-disabled": "true" }, "Next")])])]);
  assert.equal(on(body, () => listContinuesPast(asElements(cards))), undefined);
});

test("a numbered pager with a page after the current one says it continues; on its last page it does not", () => {
  const pager = (current: number) => el("nav", { class: "pages" }, [1, 2, 3].map((number) => number === current
    ? el("span", { class: "pageLink", "aria-current": "page" }, String(number))
    : el("a", { class: "pageLink", href: `?page=${number}` }, String(number))));
  const first = recipes();
  assert.deepEqual(on(el("body", {}, [el("main", {}, [first.list, pager(1)])]), () => listContinuesPast(asElements(first.cards))), { kind: "next_page", evidence: "following_page_number" });
  const last = recipes();
  assert.equal(on(el("body", {}, [el("main", {}, [last.list, pager(3)])]), () => listContinuesPast(asElements(last.cards))), undefined);
});

test("an enabled Load more says more of the list can be loaded; a disabled one says it ended", () => {
  const open = recipes();
  assert.deepEqual(on(el("body", {}, [el("main", {}, [open.list, el("button", { class: "more" }, "Load more")])]), () => listContinuesPast(asElements(open.cards))), { kind: "load_more", evidence: "load_more_control" });
  const spent = recipes();
  assert.equal(on(el("body", {}, [el("main", {}, [spent.list, el("button", { class: "more", disabled: "" }, "Load more")])]), () => listContinuesPast(asElements(spent.cards))), undefined);
});

test("a list the page declares a feed, with no control beside it, continues as it is scrolled", () => {
  const { list, cards } = recipes({ role: "feed" });
  assert.deepEqual(on(el("body", {}, [el("main", {}, [list])]), () => listContinuesPast(asElements(cards))), { kind: "infinite_scroll", evidence: "declared_feed" });
});

test("a declared row count above the rows shown continues; one equal to them does not", () => {
  const longer = recipes({ "aria-rowcount": "40" });
  assert.deepEqual(on(el("body", {}, [el("main", {}, [longer.list])]), () => listContinuesPast(asElements(longer.cards))), { kind: "infinite_scroll", evidence: "declared_feed" });
  const whole = recipes({ "aria-rowcount": "4" });
  assert.equal(on(el("body", {}, [el("main", {}, [whole.list])]), () => listContinuesPast(asElements(whole.cards))), undefined);
});

test("an ordinary list with no way on, and a read that saw no item, say nothing", () => {
  const { list, cards } = recipes();
  assert.equal(on(el("body", {}, [el("main", {}, [list, el("footer", {}, "About these recipes")])]), () => listContinuesPast(asElements(cards))), undefined);
  assert.equal(listContinuesPast([]), undefined);
});
