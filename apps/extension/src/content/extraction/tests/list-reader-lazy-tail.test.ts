// A page-by-page read reveals each page's lazily loaded tail before reading it.
//
// Live run `run-munw7ffn-fe1cecd2` read the everything store's results with
// `paginate.next` over five pages. The store draws twelve results with each
// page and fetches the last four only when a scroll brings the sentinel under
// the twelfth within reach, and a paged read never scrolled: it waited for each
// page's first item and read what was there, so results 13-16 of every page
// were never loaded and the answer was four rows short of thirteen. These tests
// read the store's own page shape (`store-pager.ts`, `lazyTail`) and ask for all
// sixteen of every page -- the first, one reached by following Next, and one a
// new document continues from a checkpoint -- and for the two limits the reveal
// keeps: a read that already sees what it can keep does not scroll, and a
// reveal the deadline cuts short ends the read as out of time.

import assert from "node:assert/strict";
import test from "node:test";
import { extractList } from "../list-reader";
import type { RefusedPageHost } from "../pagination";
import type { WebAutomationExtractListRequest } from "../../types";
import { nthPagerLink, STORE_ITEM, STORE_LAZY_TAIL, storePage } from "./store-pager";

/** A read of each card's id, which is what says which page and which place a record came from. */
const CARDS: Pick<WebAutomationExtractListRequest, "item" | "fields"> = {
  item: STORE_ITEM,
  fields: { card: { kind: "attribute", attribute: "data-card" } }
};

/** The ids of cards `first` to `last` of `page`. */
function cardIds(page: number, first = 1, last = 16): string[] {
  return Array.from({ length: last - first + 1 }, (_, offset) => `${page}-${first + offset}`);
}

/** A document served as it asked, so a continued read goes on reading it. */
const SERVED: RefusedPageHost = { status: () => 200, pause: async () => {}, reload: async () => {} };

test("a next read reveals every page's lazily loaded tail before reading it: all sixteen results of each of three pages", async () => {
  const page = storePage(1, { lazyTail: STORE_LAZY_TAIL });
  try {
    const outcome = await extractList({ ...CARDS, paginate: { mode: "next", next: nthPagerLink(4), maxPages: 3 } }, { timeoutMs: 30_000 });
    // Twelve a page is the defect: the four the sentinel fetches were never loaded.
    assert.deepEqual(outcome.records.map((record) => record.card), [...cardIds(1), ...cardIds(2), ...cardIds(3)]);
    assert.equal(outcome.pagesRead, 3);
    assert.equal(outcome.timedOut, false);
    assert.equal(outcome.paginationStop, "page_limit");
    // Page two's Next leads back to page two, and the read goes on to page three.
    assert.deepEqual(page.followed, [2, 3]);
    assert.ok(page.scrolls() >= 3, `scrolled ${page.scrolls()} times`);
  } finally {
    page.restore();
  }
});

test("a numbered read reveals each page it reaches the same way", async () => {
  const page = storePage(1, { lazyTail: STORE_LAZY_TAIL });
  try {
    const outcome = await extractList({ ...CARDS, paginate: { mode: "numbered", pages: "nav > *", maxPages: 2 } }, { timeoutMs: 30_000 });
    assert.deepEqual(outcome.records.map((record) => record.card), [...cardIds(1), ...cardIds(2)]);
    assert.equal(outcome.pagesRead, 2);
    assert.equal(outcome.timedOut, false);
  } finally {
    page.restore();
  }
});

test("a page a new document continues the read on is revealed before it is read", async () => {
  const page = storePage(2, { lazyTail: STORE_LAZY_TAIL });
  try {
    const resume = { records: cardIds(1).map((card) => ({ card })), pagesRead: 1, scrolls: 0, missingFields: [], itemsSeen: 16 };
    const outcome = await extractList({ ...CARDS, paginate: { mode: "next", next: nthPagerLink(4), maxPages: 2 } }, { timeoutMs: 30_000, resume, pageHost: SERVED });
    assert.deepEqual(outcome.records.map((record) => record.card), [...cardIds(1), ...cardIds(2)]);
    assert.equal(outcome.pagesRead, 2);
    assert.equal(outcome.itemsSeen, 32);
  } finally {
    page.restore();
  }
});

test("a paged read that already sees every record it can keep does not scroll for more", async () => {
  const page = storePage(1, { lazyTail: STORE_LAZY_TAIL });
  try {
    const outcome = await extractList({ ...CARDS, maxItems: 10, paginate: { mode: "next", next: nthPagerLink(4), maxPages: 3 } }, { timeoutMs: 30_000 });
    assert.deepEqual(outcome.records.map((record) => record.card), cardIds(1, 1, 10));
    assert.equal(outcome.paginationStop, "item_limit");
    assert.equal(page.scrolls(), 0);
  } finally {
    page.restore();
  }
});

test("the picker's preview, a read of one page with a small bound, still never scrolls the page", async () => {
  const page = storePage(1, { lazyTail: STORE_LAZY_TAIL });
  try {
    const outcome = await extractList({ ...CARDS, maxItems: 5 });
    assert.deepEqual(outcome.records.map((record) => record.card), cardIds(1, 1, 5));
    assert.equal(page.scrolls(), 0);
  } finally {
    page.restore();
  }
});

test("a reveal the deadline cuts short ends the read as out of time, with the page's drawn results, rather than as a complete page", async () => {
  const page = storePage(1, { lazyTail: { ...STORE_LAZY_TAIL, loadMs: 1_500 } });
  try {
    const outcome = await extractList({ ...CARDS, paginate: { mode: "next", next: nthPagerLink(4), maxPages: 3 } }, { timeoutMs: 500 });
    assert.deepEqual(outcome.records.map((record) => record.card), cardIds(1, 1, 12));
    assert.equal(outcome.timedOut, true);
    assert.equal(outcome.paginationStop, "deadline");
    assert.equal(outcome.pagesRead, 1);
    assert.deepEqual(page.followed, [], "a read out of time does not go on to the next page");
  } finally {
    page.restore();
  }
});
