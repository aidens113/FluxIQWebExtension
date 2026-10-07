// Moving a list to its next page: one step in each way a list continues
// (`step-page.ts`), taken page by page by the read's paged loop
// (`../pagination.ts`) and once by `web.dom.next_page` (`move-page.ts`), with
// what both share -- the page-load pace, refused pages waited out and
// reloaded, and the page the pager marks current.
//
// Split out of `../pagination.ts` (S5 of the read-list redesign, 2026-10-06),
// which keeps its exports for the read until the read stops paging (S7).

export { movePage } from "./move-page";
export { pageMoveFor } from "./continued-move";
export type { PageMove, PageMoveOptions, PageMoveOutcome } from "./move-outcome";

// The read's paged loop.
export { stepPage } from "./step-page";
export { deadlineFor } from "./list-change";
export { PaginationFault, paginationStopOf } from "./pagination-fault";
export type { PageStep, PaginationProgress, PaginationStop } from "./types";

// Both: the page-load pace, and pages the server refused.
export { awaitPageLoadTurn } from "./load-pace";
export { BROWSER_PAGE_HOST, MAX_PAGE_RETRIES, pageRefusalOf, RATE_LIMITED_STOP, refusedPageWaitMs } from "./refused-page";
export type { PageRefusal, RefusalsSpent, RefusedPageHost } from "./refused-page";
