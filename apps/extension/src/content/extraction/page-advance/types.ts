// The words and the state of one move of a list to its next page, shared by
// the read's paged loop (`../pagination.ts`, `../list-reader.ts`) and
// `web.dom.next_page` (`./move-page.ts`).

import type { WebAutomationExtractionSummary } from "@fluxiq-web-extension/domain/client";
import type { WebAutomationNextPageBy } from "../../../shared/protocol";
import type { RetryBudget } from "../load-retry";

/** Why a move did not move the list: the domain's closed set of words. */
export type PaginationStop = NonNullable<WebAutomationExtractionSummary["paginationStop"]>;

/**
 * What one step did: `advanced`, saying how; `ended`, the list having no next
 * page; `truncated`, a bound stopping it while the list could go on; or
 * `timed_out`, the deadline passing first. Everything but `advanced` says why.
 */
export type PageStep =
  | { outcome: "advanced"; by: WebAutomationNextPageBy }
  | { outcome: "ended" | "truncated" | "timed_out"; stop: PaginationStop };

/** The state a step reads and updates: the read's progress, or a next-page step's one move. */
export type PaginationProgress = {
  /** The item selector. */
  item: string;
  /** The items the page showed at the last read, in document order. */
  shown: readonly Element[];
  /**
   * Pages read so far, the first included. A next-page step, which keeps no
   * count, sets the page the pager marks current, or 1 where it marks none.
   */
  pagesRead: number;
  /** Scrolls made so far. A step counts each `scroll` it makes here. */
  scrolls: number;
  /** When the whole command must stop, or `undefined` when nothing bounds it. */
  deadline: number | undefined;
  /** Whether the page shows an item the read has not taken. */
  hasUnreadItem(): boolean;
  /**
   * Called, and awaited, just before a control is followed, with how the list
   * is about to move: the last moment the document is certainly still here.
   * The read checkpoints its records; a next-page step marks its press.
   */
  beforeFollow?: ((by: WebAutomationNextPageBy) => Promise<void>) | undefined;
  /**
   * The Retry presses made for the list (`../load-retry.ts`), shared with the
   * reveal of each page (`../list-wait.ts`). A step starts one where none was given.
   */
  listRetries?: RetryBudget | undefined;
  /**
   * Whether, when a step last followed a `next` or numbered control, the pager
   * beside it showed a page numbered after the current one. A page that then
   * repeats an earlier one is the read failing to move on while the list goes
   * on (`../pagination.ts`).
   */
  laterPageShown?: boolean | undefined;
};
