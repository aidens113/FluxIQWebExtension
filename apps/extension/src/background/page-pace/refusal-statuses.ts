/**
 * The HTTP statuses that say a site refused a load for coming too fast (429) or
 * while it cannot serve one (503): the refusals the page-load pace slows an
 * origin for (`origin-pace.ts`), and the ones a navigation reports as rate
 * limited rather than as a page refused for good (`runtime/action-runner.ts`).
 * The page's own read of a refused results page (`content/extraction/
 * pagination.ts`) judges the same two.
 */
export const PAGE_REFUSAL_STATUSES: ReadonlySet<number> = new Set([429, 503]);
