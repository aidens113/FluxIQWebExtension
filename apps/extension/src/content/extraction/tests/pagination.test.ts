// T1 coverage of pagination's pure half: each mode's bound held to the domain's
// page bound, the deadline a command's `timeoutMs` sets, and a mode the page
// does not know refused before the page is touched. Node has no `document`,
// so an advance that reached the page would throw a ReferenceError instead of
// the refusal the last row expects. Following each mode on a live page is
// proven by `e2e/content/tests/extract-list.spec.ts`, under Chromium and
// Firefox.

import assert from "node:assert/strict";
import test from "node:test";
import { WEB_AUTOMATION_EXTRACT_MAX_PAGES } from "@fluxiq-web-extension/domain/client";
import type { WebAutomationExtractListPagination, WebAutomationExtractListRequest } from "../../types";
import { extractList } from "../list-reader";
import { advancePage, BROWSER_PAGE_HOST, deadlineFor, MAX_PAGE_RETRIES, pageRefusalOf, paginationBound, PaginationFault, paginationStopOf, refusedPageWaitMs, type PaginationProgress } from "../pagination";
import { NEXT_BUTTON, nthPagerLink, PAGE_COUNT, PAGE_ITEM, STORE_ITEM, storePage, type PagerStyle } from "./store-pager";

/** A requested bound, and what the page holds it to. */
const BOUNDS: ReadonlyArray<readonly [requested: number, held: number]> = [
  [3, 3],
  [1, 1],
  [0, 1],
  [-4, 1],
  [2.9, 2],
  [WEB_AUTOMATION_EXTRACT_MAX_PAGES, WEB_AUTOMATION_EXTRACT_MAX_PAGES],
  [WEB_AUTOMATION_EXTRACT_MAX_PAGES + 1, WEB_AUTOMATION_EXTRACT_MAX_PAGES],
  [10_000, WEB_AUTOMATION_EXTRACT_MAX_PAGES],
  [Number.POSITIVE_INFINITY, WEB_AUTOMATION_EXTRACT_MAX_PAGES],
  [Number.NaN, 1]
];

test("maxPages is held between 1 and the domain's page bound in every paged mode", () => {
  for (const [maxPages, held] of BOUNDS) {
    const paginations: WebAutomationExtractListPagination[] = [
      { next: ".next", maxPages },
      { mode: "next", next: ".next", maxPages },
      { mode: "loadMore", control: ".more", maxPages },
      { mode: "numbered", pages: ".page", maxPages }
    ];
    for (const paginate of paginations) assert.equal(paginationBound(paginate), held, `${paginate.mode ?? "next"} with maxPages ${maxPages}`);
  }
});

test("maxScrolls is held the same way, and a scroll read ignores any maxPages sent with it", () => {
  for (const [maxScrolls, held] of BOUNDS) assert.equal(paginationBound({ mode: "scroll", maxScrolls }), held, `maxScrolls ${maxScrolls}`);
  assert.equal(paginationBound({ mode: "scroll", maxScrolls: 4, maxPages: 1 } as never), 4);
});

test("a bound that is not a number, sent straight to the page, reads as one", () => {
  assert.equal(paginationBound({ next: ".next", maxPages: "50" } as never), 1);
  assert.equal(paginationBound({ mode: "scroll" } as never), 1);
});

test("a positive timeoutMs sets a deadline that far ahead, and anything else sets none", () => {
  for (const timeoutMs of [undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) assert.equal(deadlineFor(timeoutMs), undefined, String(timeoutMs));
  const before = Date.now();
  const deadline = deadlineFor(250);
  assert.ok(deadline !== undefined && deadline >= before + 250 && deadline <= Date.now() + 250, String(deadline));
});

test("a pagination mode the page does not know is refused before the page is touched", async () => {
  const progress: PaginationProgress = {
    item: ".row",
    shown: [],
    pagesRead: 1,
    scrolls: 0,
    deadline: undefined,
    hasUnreadItem: () => assert.fail("the refusal asked the page for unread items")
  };
  await assert.rejects(advancePage({ mode: "infinite", maxPages: 3 } as never, progress), /does not know pagination mode "infinite"/u);
  await assert.rejects(advancePage({ mode: 7, next: ".next", maxPages: 3 } as never, progress), /does not know a pagination mode that is not a string/u);
});

test("a move that threw says which way it failed: a pagination fault's own word, and page_fault for anything else", () => {
  assert.equal(paginationStopOf(new PaginationFault("list_unchanged", "The list did not change.")), "list_unchanged");
  assert.equal(paginationStopOf(new PaginationFault("control_not_clickable", "Not clickable.")), "control_not_clickable");
  assert.equal(paginationStopOf(new Error("The node was detached.")), "page_fault");
  assert.equal(paginationStopOf("not even an error"), "page_fault");
});

// And the policy for a page the server refused (`run-munnhi5q-4867dabe`: the
// store's 429 page, mid-pagination, read as the list ending). The reload itself
// needs a document and is proven across documents in
// `list-reader-refused-page.test.ts`.

test("a status says whether the server refused the page: 429 and 503 are refusals, no status is unexplained, anything else was served", () => {
  assert.equal(pageRefusalOf(429), "rate_limited");
  assert.equal(pageRefusalOf(503), "unavailable");
  assert.equal(pageRefusalOf(undefined), "unexplained");
  for (const served of [200, 204, 404, 500]) assert.equal(pageRefusalOf(served), undefined, String(served));
  // Node has no navigation entry, which is the browser that gives no status.
  assert.equal(BROWSER_PAGE_HOST.status(), undefined);
});

test("the first retry outlasts an 8 s rate-limit window, and a read never reloads into what could be its third refusal as too fast", () => {
  const none = { retries: 0, rateLimits: 0 };
  assert.ok((refusedPageWaitMs("rate_limited", none, undefined, true) ?? 0) > 8_000);
  assert.equal(refusedPageWaitMs("rate_limited", none, undefined, true), 8_500);
  // A second 429 is the read's second refusal: it stops rather than risk a third.
  assert.equal(refusedPageWaitMs("rate_limited", { retries: 1, rateLimits: 1 }, undefined, true), undefined);
  // An unexplained page counts as a possible 429, both ways.
  assert.equal(refusedPageWaitMs("unexplained", none, undefined, true), 8_500);
  assert.equal(refusedPageWaitMs("unexplained", { retries: 1, rateLimits: 1 }, undefined, true), undefined);
  // A 503 is no limiter's refusal: it may be retried up to the bound, each wait twice the last.
  assert.equal(refusedPageWaitMs("unavailable", none, undefined, true), 8_500);
  assert.equal(refusedPageWaitMs("unavailable", { retries: 1, rateLimits: 0 }, undefined, true), 17_000);
  assert.equal(refusedPageWaitMs("unavailable", { retries: MAX_PAGE_RETRIES, rateLimits: 0 }, undefined, true), undefined);
  assert.equal(MAX_PAGE_RETRIES, 2);
});

test("a retry the read's time cannot cover, or one whose reload would lose the read, is not made", () => {
  const none = { retries: 0, rateLimits: 0 };
  assert.equal(refusedPageWaitMs("rate_limited", none, 10_500, true), 8_500);
  assert.equal(refusedPageWaitMs("rate_limited", none, 10_499, true), undefined);
  assert.equal(refusedPageWaitMs("rate_limited", none, undefined, false), undefined);
});

// And the page half of a `next` read: which control it follows, on a pager
// shaped like the everything store's (`store-pager.ts`), where Previous is a
// link on every page but the first and so the position of Next moves. Live run
// `run-munv53gt-a0e6f545` authored `a:nth-of-type(6)` -- Next on pages three
// and four -- and played it back from page one, where it names nothing: one
// page read, `control_absent`, while the page showed Next. Re-authored as
// `a:nth-of-type(4)`, the read names Next on page one and "5" on page two.

/** A page advance from the store's page `page` with `next` authored, and where it led. */
async function advanceFrom(page: number, next: string, options: { pager?: "drawn" | "late" | "none"; drawAfterMs?: number } = {}): Promise<{ advance: Awaited<ReturnType<typeof advancePage>>; followed: number[]; tookMs: number }> {
  const shown = storePage(page, { pager: options.pager ?? "drawn" });
  const first = shown.cards[0];
  try {
    const progress: PaginationProgress = {
      item: STORE_ITEM,
      shown: shown.cards as unknown as Element[],
      pagesRead: 1,
      scrolls: 0,
      deadline: Date.now() + 20_000,
      hasUnreadItem: () => first?.isConnected === false
    };
    if (options.drawAfterMs !== undefined) setTimeout(shown.drawPager, options.drawAfterMs);
    const startedAt = Date.now();
    const advance = await advancePage({ next, maxPages: 10 }, progress);
    return { advance, followed: shown.followed, tookMs: Date.now() - startedAt };
  } finally {
    shown.restore();
  }
}

test("the fake pager places Next where the store's does: fourth link on page one, fifth on page two, sixth on pages three and four", () => {
  const nextAt = (page: number, position: number): string | null => {
    const shown = storePage(page);
    try {
      return document.querySelector(nthPagerLink(position))?.getAttribute("aria-label") ?? null;
    } finally {
      shown.restore();
    }
  };
  assert.equal(nextAt(1, 4), "Go to next page, page 2");
  assert.equal(nextAt(1, 6), null, "the selector authored on page three names nothing on page one");
  assert.equal(nextAt(2, 4), "Go to page 5", "the selector authored on page one names a page number on page two");
  assert.equal(nextAt(3, 6), "Go to next page, page 4");
  assert.equal(nextAt(5, 4), "Go to page 3");
});

test("page one of a list whose authored next names nothing there follows the pager's own Next, not control_absent", async () => {
  const { advance, followed } = await advanceFrom(1, nthPagerLink(6));
  assert.deepEqual(advance, { outcome: "advanced" });
  assert.deepEqual(followed, [2]);
});

test("an authored next that names Next on this page is followed as authored", async () => {
  const { advance, followed } = await advanceFrom(3, nthPagerLink(6));
  assert.deepEqual(advance, { outcome: "advanced" });
  assert.deepEqual(followed, [4]);
});

test("an authored next that drifted onto a page number follows Next instead, and page two's Next that leads back is swapped for page three", async () => {
  const { advance, followed } = await advanceFrom(2, nthPagerLink(4));
  assert.deepEqual(advance, { outcome: "advanced" });
  assert.deepEqual(followed, [3], "not page five, which the positional selector names on page two");
});

test("on the last page an authored next that drifted onto a page number ends on the pager's disabled Next rather than going back", async () => {
  const { advance, followed } = await advanceFrom(5, nthPagerLink(4));
  assert.deepEqual(advance, { outcome: "ended", stop: "control_disabled" });
  assert.deepEqual(followed, []);
});

test("a page that draws its pager after its items is waited for, and its Next followed", async () => {
  const { advance, followed } = await advanceFrom(1, nthPagerLink(4), { pager: "late", drawAfterMs: 300 });
  assert.deepEqual(advance, { outcome: "advanced" });
  assert.deepEqual(followed, [2]);
});

test("a page that shows items and never a pager ends on control_absent after a bounded wait", async () => {
  const { advance, followed, tookMs } = await advanceFrom(1, nthPagerLink(4), { pager: "none" });
  assert.deepEqual(advance, { outcome: "ended", stop: "control_absent" });
  assert.deepEqual(followed, []);
  assert.ok(tookMs >= 900 && tookMs < 3_000, `waited ${tookMs} ms`);
});

// And the pager drawn the way two other sites draw theirs (`store-pager.ts`,
// `PagerStyle`). Guildline's people search (t194-w27 G1) draws every page
// control as a `<button>`, and its Next loads the page after the one the
// document opened on, so from page two it loads page two: a `next` read
// followed it and stopped on page two with 20 of 23 people, because only a
// Next that is a *link* to its own page was swapped for the pager's following
// number. The marketplace's unfiltered search (t194-w26 G5) marks no page
// `aria-current`, and from page two its Previous shares the numbers' class, so
// a numbered read that picked the control after the pages read by position
// picked "2" from page two and re-read it as page three.

/** One advance from page `page` of a pager drawn in `style`, as a read that has read `pagesRead` pages. */
async function advanceStyled(page: number, paginate: WebAutomationExtractListPagination, style: PagerStyle, pagesRead = 1): Promise<{ advance: Awaited<ReturnType<typeof advancePage>>; followed: number[]; laterPageShown: boolean | undefined }> {
  const shown = storePage(page, style);
  const first = shown.cards[0];
  try {
    const progress: PaginationProgress = {
      item: STORE_ITEM,
      shown: shown.cards as unknown as Element[],
      pagesRead,
      scrolls: 0,
      deadline: Date.now() + 20_000,
      hasUnreadItem: () => first?.isConnected === false
    };
    const advance = await advancePage(paginate, progress);
    return { advance, followed: shown.followed, laterPageShown: progress.laterPageShown };
  } finally {
    shown.restore();
  }
}

test("a script's Next that loads page two again from page two is swapped for the pager's page three, as a link back to its own page is", async () => {
  const { advance, followed, laterPageShown } = await advanceStyled(2, { next: NEXT_BUTTON, maxPages: 10 }, { controls: "buttons" });
  assert.deepEqual(advance, { outcome: "advanced" });
  assert.deepEqual(followed, [3], "not page two again, which the script's Next loads");
  assert.equal(laterPageShown, true, "the pager showed pages after two");
});

test("a script's Next goes where the pager's following number goes, and an advance from a page the read cannot leave still says the pager showed a later one", async () => {
  // Page four of five: the pager shows 5, so the swap goes there. Page four's own Next loads five too.
  const { followed, laterPageShown } = await advanceStyled(4, { next: NEXT_BUTTON, maxPages: 10 }, { controls: "buttons" });
  assert.deepEqual(followed, [5]);
  assert.equal(laterPageShown, true);
  const stuck = await advanceStyled(2, { next: NEXT_BUTTON, maxPages: 10 }, { controls: "buttons", stuckOn: 2 });
  assert.deepEqual(stuck.followed, [2], "page three's control loads page two here, which the read cannot know before pressing it");
  assert.equal(stuck.laterPageShown, true, "and the pager did show a later page");
});

test("a numbered read on a pager that marks no page current finds page two by its link to this document, and follows three, not two again", async () => {
  const { advance, followed, laterPageShown } = await advanceStyled(2, { mode: "numbered", pages: PAGE_ITEM, maxPages: 10 }, { current: "self-link" }, 2);
  assert.deepEqual(advance, { outcome: "advanced" });
  assert.deepEqual(followed, [3], "Previous shares the numbers' mark, so the third control is page two");
  assert.equal(laterPageShown, true);
});

test("a numbered read on a pager that says nothing of the current page counts its numbers, not its controls", async () => {
  const { followed } = await advanceStyled(2, { mode: "numbered", pages: PAGE_ITEM, maxPages: 10 }, { current: "unmarked" }, 2);
  assert.deepEqual(followed, [3]);
  const third = await advanceStyled(3, { mode: "numbered", pages: PAGE_ITEM, maxPages: 10 }, { current: "unmarked" }, 3);
  assert.deepEqual(third.followed, [4]);
});

test("a numbered read on the last page of a pager that marks no page current ends there rather than going back", async () => {
  const { advance, followed } = await advanceStyled(5, { mode: "numbered", pages: PAGE_ITEM, maxPages: 10 }, { current: "self-link" }, 5);
  assert.deepEqual(advance, { outcome: "ended", stop: "no_following_page" });
  assert.deepEqual(followed, []);
});

// Whole `next` and numbered reads over pagers other sites draw (`store-pager.ts`,
// `PagerStyle`), and what a read that cannot move on says of itself.
//
// - Guildline's people search (t194-w27 G1): every page control a `<button>`,
//   and a script's Next that from page two loads page two. A `next` read
//   stopped there on `page_repeated`, 20 of 23 people, `truncated: false` --
//   an incomplete answer reported as a complete one.
// - The marketplace's unfiltered search (t194-w26 G5): no `aria-current`, and
//   from page two a Previous that shares the numbers' class. A numbered read
//   picked page two again as "page three".
// - A page every control of which loads that page again, while the pager shows
//   pages after it: the read cannot move on, and must say it is cut short.

/** A read of each card's id, which is what says which page and which place a record came from. */
const CARDS: Pick<WebAutomationExtractListRequest, "item" | "fields"> = {
  item: STORE_ITEM,
  fields: { card: { kind: "attribute", attribute: "data-card" } }
};

/** The ids of the four cards of each of `pages`. */
function cardIds(...pages: number[]): string[] {
  return pages.flatMap((page) => [1, 2, 3, 4].map((index) => `${page}-${index}`));
}

const EVERY_PAGE = Array.from({ length: PAGE_COUNT }, (_, index) => index + 1);

test("a next read over a pager of buttons whose script Next loads page two again reads every page, and ends on the disabled Next", async () => {
  const page = storePage(1, { controls: "buttons" });
  try {
    const outcome = await extractList({ ...CARDS, paginate: { mode: "next", next: NEXT_BUTTON, maxPages: 10 } }, { timeoutMs: 30_000 });
    assert.deepEqual(outcome.records.map((record) => record.card), cardIds(...EVERY_PAGE));
    assert.equal(outcome.pagesRead, PAGE_COUNT);
    assert.equal(outcome.paginationStop, "control_disabled");
    assert.equal(outcome.truncated, false);
    assert.deepEqual(page.followed, [2, 3, 4, 5]);
  } finally {
    page.restore();
  }
});

test("a read that cannot leave a page while the pager shows later ones stops on page_repeated as truncated, never as complete", async () => {
  const page = storePage(1, { controls: "buttons", stuckOn: 2 });
  try {
    const outcome = await extractList({ ...CARDS, paginate: { mode: "next", next: NEXT_BUTTON, maxPages: 10 } }, { timeoutMs: 30_000 });
    assert.deepEqual(outcome.records.map((record) => record.card), cardIds(1, 2));
    assert.equal(outcome.paginationStop, "page_repeated");
    assert.equal(outcome.truncated, true, "pages three to five were on the pager and never read");
  } finally {
    page.restore();
  }
});

test("a numbered read on a pager that marks no page current, whose Previous shares the numbers' mark, reads every page once", async () => {
  const page = storePage(1, { current: "self-link" });
  try {
    const outcome = await extractList({ ...CARDS, paginate: { mode: "numbered", pages: PAGE_ITEM, maxPages: 10 } }, { timeoutMs: 30_000 });
    assert.deepEqual(outcome.records.map((record) => record.card), cardIds(...EVERY_PAGE));
    assert.equal(outcome.pagesRead, PAGE_COUNT);
    assert.equal(outcome.paginationStop, "no_following_page");
    assert.equal(outcome.truncated, false);
    assert.deepEqual(page.followed, [2, 3, 4, 5]);
  } finally {
    page.restore();
  }
});
