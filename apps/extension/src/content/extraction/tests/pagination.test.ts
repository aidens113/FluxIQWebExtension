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
import type { WebAutomationExtractListPagination } from "../../types";
import { advancePage, BROWSER_PAGE_HOST, deadlineFor, MAX_PAGE_RETRIES, pageRefusalOf, paginationBound, PaginationFault, paginationStopOf, refusedPageWaitMs, type PaginationProgress } from "../pagination";
import { nthPagerLink, STORE_ITEM, storePage } from "./store-pager";

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

// And a load-more control the page keeps after its last page, hidden
// (t195-w19c R1): Guildline's Sent invitations sets `hidden` on its "Show more"
// once the last page is in (`professional-network/network/manager-client.ts`).
// A hidden control is the list's ordinary end, read before the page bound, and
// is never pressed.

/** A load-more control, hidden by attribute or by having no box, that counts its presses. */
function loadMoreControl(options: { hidden?: boolean; boxes?: number } = {}) {
  const control = {
    hidden: options.hidden ?? false,
    boxes: options.boxes ?? 1,
    clicks: 0,
    isConnected: true,
    getAttribute: (name: string): string | null => (name === "hidden" && control.hidden ? "" : null),
    matches: (): boolean => false,
    getClientRects: (): unknown[] => Array.from({ length: control.boxes }, () => ({})),
    click: (): void => {
      control.clicks += 1;
    }
  };
  return control;
}

/** One `loadMore` advance with `control` as the page's only control, from `pagesRead` pages read of `maxPages`. */
async function pressFrom(control: ReturnType<typeof loadMoreControl>, pagesRead: number, maxPages: number): Promise<{ advance: Awaited<ReturnType<typeof advancePage>>; tookMs: number }> {
  const saved = (globalThis as Record<string, unknown>).document;
  (globalThis as Record<string, unknown>).document = { querySelector: (selector: string) => (selector === ".more" ? control : null) };
  try {
    const progress: PaginationProgress = { item: ".row", shown: [], pagesRead, scrolls: 0, deadline: Date.now() + 20_000, hasUnreadItem: () => false };
    const startedAt = Date.now();
    const advance = await advancePage({ mode: "loadMore", control: ".more", maxPages }, progress);
    return { advance, tookMs: Date.now() - startedAt };
  } finally {
    (globalThis as Record<string, unknown>).document = saved;
  }
}

test("a load-more control that is present and hidden ends the list, unpressed, after a short grace", async () => {
  const control = loadMoreControl({ hidden: true });
  const { advance, tookMs } = await pressFrom(control, 2, 10);
  assert.deepEqual(advance, { outcome: "ended", stop: "control_absent" });
  assert.equal(control.clicks, 0);
  assert.ok(tookMs >= 900 && tookMs < 3_000, `waited ${tookMs} ms`);
});

test("a load-more control with no box is hidden too", async () => {
  const control = loadMoreControl({ boxes: 0 });
  const { advance } = await pressFrom(control, 2, 10);
  assert.deepEqual(advance, { outcome: "ended", stop: "control_absent" });
  assert.equal(control.clicks, 0);
});

test("at the page bound a hidden load-more control ends the list rather than truncating it", async () => {
  const control = loadMoreControl({ hidden: true });
  const { advance } = await pressFrom(control, 3, 3);
  assert.deepEqual(advance, { outcome: "ended", stop: "control_absent" });
});

test("at the page bound a visible load-more control is still truncation", async () => {
  const control = loadMoreControl();
  const { advance, tookMs } = await pressFrom(control, 3, 3);
  assert.deepEqual(advance, { outcome: "truncated", stop: "page_limit" });
  assert.equal(control.clicks, 0);
  assert.ok(tookMs < 500, `took ${tookMs} ms`);
});

test("a load-more control hidden only while the page settles is waited for, not read as the end", async () => {
  const control = loadMoreControl({ hidden: true });
  setTimeout(() => {
    control.hidden = false;
  }, 200);
  const { advance } = await pressFrom(control, 3, 3);
  assert.deepEqual(advance, { outcome: "truncated", stop: "page_limit" });
});
