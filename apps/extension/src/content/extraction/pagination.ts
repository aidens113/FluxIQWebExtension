// How `web.dom.extract_list` reaches the next page of a list in each pagination
// mode, and how long the whole read may take.
//
// `list-reader.ts` reads the items the page shows, then calls `advancePage`
// once per page. The answer says what happened:
// - `advanced`: the page now shows items the read has not taken;
// - `ended`: the list has no more pages, which is not truncation;
// - `truncated`: the mode's bound stopped the read while the list could have
//   gone on;
// - `timed_out`: the command's deadline passed before the next page arrived.
//
// Each advance is one step of `page-advance/` (`step-page.ts` there says what
// each mode does, and why each protection is there), which `web.dom.next_page`
// takes too. What stays here is the read's own: its bound. For `next`,
// `loadMore` and `numbered`, having read `maxPages` pages while a way forward
// is still there is truncation; for `scroll`, having scrolled `maxScrolls`
// times. Every bound is held to the domain's page bound. Every mode checks the
// command's deadline before each advance and never moves past the last page it
// read, so a read that finishes leaves the page showing its last page
// (decision D5).
//
// The step's ways are the read's modes without their bounds, and a mode named
// `next` here is a way named `next` there, so the read's `paginate` is handed
// to the step as it is; only the bound is taken off it.
//
// A page that repeats while the pager showed a later one is a read that could
// not move on, not a list that ended: before each `next` or numbered follow the
// step records whether the pager showed a page numbered after the current one
// (`PaginationProgress.laterPageShown`), and a read that then stops on
// `page_repeated` says `truncated: true` (`list-reader.ts`).
//
// The moved names are re-exported here for the read until it stops paging (S7).

import { WEB_AUTOMATION_EXTRACT_MAX_PAGES } from "@fluxiq-web-extension/domain/client";
import type { WebAutomationExtractListPagination } from "../types";
import { stepPage, type PaginationProgress, type PaginationStop } from "./page-advance";

export {
  awaitPageLoadTurn,
  BROWSER_PAGE_HOST,
  deadlineFor,
  MAX_PAGE_RETRIES,
  pageRefusalOf,
  PaginationFault,
  paginationStopOf,
  RATE_LIMITED_STOP,
  refusedPageWaitMs
} from "./page-advance";
export type { PageRefusal, PaginationProgress, PaginationStop, RefusalsSpent, RefusedPageHost } from "./page-advance";

/** What one advance did: see the header. Everything but `advanced` says why. */
export type PageAdvance =
  | { outcome: "advanced" }
  | { outcome: "ended" | "truncated" | "timed_out"; stop: PaginationStop };

const ADVANCED: PageAdvance = { outcome: "advanced" };

/**
 * The mode's bound held to the domain's page bound and to at least 1:
 * `maxScrolls` for `scroll`, `maxPages`, the first page included, for the rest.
 * A bound that is not a number reads as 1, so nothing sent straight to the
 * page can make a read unbounded.
 */
export function paginationBound(paginate: WebAutomationExtractListPagination): number {
  const requested: unknown = paginate.mode === "scroll" ? paginate.maxScrolls : paginate.maxPages;
  const whole = typeof requested === "number" && !Number.isNaN(requested) ? Math.trunc(requested) : 1;
  return Math.min(Math.max(1, whole), WEB_AUTOMATION_EXTRACT_MAX_PAGES);
}

/** Moves the list on by one page in the request's mode, held to the read's bound; see the header. */
export async function advancePage(paginate: WebAutomationExtractListPagination, progress: PaginationProgress): Promise<PageAdvance> {
  const step = await stepPage(paginate, progress, paginationBound(paginate));
  return step.outcome === "advanced" ? ADVANCED : step;
}
