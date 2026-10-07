// What a model reads about the "Next page" node when it builds a Flow.
//
// Core's Flow Bootstrap ranks node definitions against the instruction by id,
// label, description and tags, and shows the model each chosen definition's
// description (kept to 240 characters, its first sentence standing alone within
// 80) and the description and example of each object parameter. So the tags
// carry the words people use for paging through results, the description says
// what the node is for and how it ends, and the `nextPage` parameter carries
// the request's grammar (`./parameters.ts`).
//
// **The model names the list, not a selector** (contract C2). It is never shown
// a selector, so the grammar leads with the handle of a detected list, which
// plan resolution turns into the request the page runs: the list's item, and the
// way to its next page as detection found it, without a page budget.
//
// **One step moves one page.** The read beside it reads one page too, so
// "every page" is a loop: read, next page, back to the read, leaving by
// `ended`. The description says so, because a node that does not say how it
// ends is a node a loop is wired to without an exit.

/** Words of a request to page through results. A tag of two words is ranked as both. */
export const WEB_AUTOMATION_NEXT_PAGE_TAGS: readonly string[] = [
  "next page",
  "pagination",
  "paginate",
  "load more",
  "more results",
  "infinite scroll",
  "every page",
  "all pages"
];

/** The node's description: what it is for, how its list is named, and how a loop over pages ends. */
export const WEB_AUTOMATION_NEXT_PAGE_DESCRIPTION = [
  "Show the next page of a detected list, or answer ended when there is none.",
  "Next, a numbered page, Load more or scrolling; one page per step.",
  "Loop it after a one-page read and wire ended out of the loop."
].join(" ");

/** The shape of `nextPage`, for a model to write one: the handle of a detected list first, then the literal request. */
export const WEB_AUTOMATION_NEXT_PAGE_GRAMMAR = [
  `{list: "extraction.N", control?: "tN"}: the detected list, and optionally the page's own Next control by its handle.`,
  "Or {item: css, pagination?: {mode: next|loadMore|scroll|numbered, next|control|pages: css}}.",
  "No maxPages: one step moves one page; loop for more."
].join(" ");
