// The answer half of `web.dom.next_page` (contract C1): the list moved, the
// list has no next page, or the move failed.
//
// The words are `web.dom.extract_list`'s pagination stop words
// (`../extraction/summary.ts`), partitioned by who ended the move, and declared
// as subsets of that type so the two vocabularies cannot drift. Every bound a
// read has -- `page_limit`, `item_limit`, `deadline` -- is absent, because a
// one-page step has none, and so is `page_repeated`, which only a read that
// keeps records can see.
//
// `moved` and `ended` are a succeeded action; `failed` is a failed one, with
// the closed set's code for its word: `list_unchanged` and `list_vanished` are
// `OUTPUT_NOT_OBSERVED`, `rate_limited` is `RATE_LIMITED`,
// `control_not_clickable` is `TARGET_NOT_ACTIONABLE`, and `page_fault` is
// `ACTION_FAILED`. An `ended` answer is also the result's `route: "ended"`,
// which is what Core routes the node's `ended` output by.

import type { WebAutomationExtractionPaginationStop } from "../extraction";

/** What moved the list: a Next control, the link that follows the current page, a numbered page, a load-more control, or scrolling. */
export type WebAutomationNextPageBy = "next" | "following" | "numbered" | "loadMore" | "scroll";

/** Why the list has no next page. A list's end, never a failure. */
export type WebAutomationNextPageEnd = Extract<WebAutomationExtractionPaginationStop, "control_absent" | "control_disabled" | "no_following_page" | "scrolled_to_end">;

/** Why the move failed. */
export type WebAutomationNextPageFault = Extract<WebAutomationExtractionPaginationStop, "list_unchanged" | "rate_limited" | "list_vanished" | "control_not_clickable" | "page_fault">;

/** `web.dom.next_page`'s answer. `page` is the number the pager marks current after the move, when it marks one. */
export type WebAutomationNextPageAnswer =
  | { outcome: "moved"; by: WebAutomationNextPageBy; page?: number | undefined }
  | { outcome: "ended"; stop: WebAutomationNextPageEnd }
  | { outcome: "failed"; stop: WebAutomationNextPageFault };
