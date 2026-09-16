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
import { advancePage, deadlineFor, paginationBound, type PaginationProgress } from "../pagination";

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
