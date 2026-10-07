// Choosing a list's numbered page: re-query the `pages` controls after every
// change and click the one that follows the current page -- the control
// numbered one more than the current page's, or the current control's next
// sibling among them when it carries no number (`../pager-reading/`,
// `followingPageControl`). No following control is the list ending. The change
// and the wait for records are those of `next` (`./list-change.ts`).

import type { WebAutomationNextPageWay } from "../../../shared/protocol";
import { followingPageControl } from "../pager-reading";
import { afterListChange, clickable, pastDeadline } from "./list-change";
import { awaitPageLoadTurn } from "./load-pace";
import type { PageStep, PaginationProgress } from "./types";

/** Follows the page after the current one; `bound`, when there is one, is the pages the read may read. */
export async function visitNumberedPage(way: Extract<WebAutomationNextPageWay, { mode: "numbered" }>, progress: PaginationProgress, bound: number | undefined): Promise<PageStep> {
  const following = followingPageControl(Array.from(document.querySelectorAll(way.pages)), progress.pagesRead);
  if (!following) return { outcome: "ended", stop: "no_following_page" };
  if (bound !== undefined && progress.pagesRead >= bound) return { outcome: "truncated", stop: "page_limit" };
  const control = clickable(following, way.pages);
  progress.laterPageShown = true;
  if (pastDeadline(progress.deadline)) return { outcome: "timed_out", stop: "deadline" };
  await awaitPageLoadTurn(progress.deadline);
  if (pastDeadline(progress.deadline)) return { outcome: "timed_out", stop: "deadline" };
  await progress.beforeFollow?.("numbered");
  return await afterListChange(way, progress, control, `choosing page ${progress.pagesRead + 1} from ${JSON.stringify(way.pages)}`, "numbered");
}
