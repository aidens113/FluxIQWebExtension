// Following a list's Next: the authored selector's control, or the pager's own
// Next where that selector names nothing or another page's control
// (`../detect-pagination.ts`, `nextControlOnPage`), or -- with no selector at
// all, which is a next-page step whose list carried no pagination -- the pager
// found by walking up from the list's first item.
//
// **A Next that leads back to the page it is on**, which the job board does
// from page two on, is swapped for the pager's following page. Following it
// reloads the page, and a read that followed it would read the same page until
// its bound. When the pager beside it shows the current page's number and a
// control numbered one more, that is followed instead (`by: "following"`); when
// it marks the current page and shows no page after it, the list has ended
// (`no_following_page`, nothing pressed); when it shows neither, the Next is
// followed anyway, and the read stops on
// `page_repeated` when the page it reaches holds nothing new
// (`../list-reader.ts`). **A script's Next is treated the same way**, because
// it carries no address to be checked against this page: Guildline's people
// search draws Next as a `<button>` that loads the page after the one the
// document opened on, so from page two it loads page two, and a `next` read
// stopped there with 20 of 23 people (t194-w27 G1). Following the pager's
// following number is what a working Next does anyway.

import type { WebAutomationNextPageWay } from "../../../shared/protocol";
import { nextControlOnPage, type NextControlChoice } from "../detect-pagination";
import { waitUntil } from "../list-wait";
import { isDisabled, leadsToThisPage, linkAddress, readPager } from "../pager-reading";
import { afterListChange, clickable, pastDeadline } from "./list-change";
import { awaitPageLoadTurn } from "./load-pace";
import type { PageStep, PaginationProgress } from "./types";

/**
 * How long a page that shows its items and no way forward is watched for one
 * before the list counts as ended. A page that draws its pager with, or after,
 * results it loads late has not ended its list when the first item appears,
 * and a page that has ended it pays this once, on its last page. A list with no
 * container has no pager to wait for, and does not wait.
 */
const PAGER_WAIT_MS = 1_000;
export const PAGER_POLL_MS = 50;

/**
 * Follows the Next named by `selector`, or found from the list when it names
 * none. A disabled one is the list ending; one that leads back to this very
 * page, or a script's that has no address to say where it leads, is swapped
 * for the pager's following page where the pager shows one (see the header).
 * `bound`, when there is one, is the pages the read may read.
 */
export async function followNext(way: Extract<WebAutomationNextPageWay, { next: string }> | undefined, progress: PaginationProgress, bound: number | undefined): Promise<PageStep> {
  const selector = way?.next;
  const found = await awaitNextControl(selector, progress);
  if (found === "timed_out") return { outcome: "timed_out", stop: "deadline" };
  if (!found) return { outcome: "ended", stop: "control_absent" };
  const next = found.control;
  if (isDisabled(next)) return { outcome: "ended", stop: "control_disabled" };
  if (bound !== undefined && progress.pagesRead >= bound) return { outcome: "truncated", stop: "page_limit" };
  const named = clickable(next, selector);
  const pager = readPager(named);
  // A Next with an address is checked against this page before it is
  // followed; a script's Next has none to check, so where the pager beside it
  // shows the page after the current one, that is followed (see the header).
  const unaddressed = leadsToThisPage(named) || linkAddress(named) === undefined;
  // Such a Next on a pager that marks the current page and shows no page after
  // it is on the last page: pressing it reloads this page (Guildline keeps its
  // script Next enabled there), and a read + Next page loop would read it
  // again on every pass (S6 GAP N1). The paged read used to notice the repeat
  // after the press; a next-page step keeps no history, so it ends here.
  if (unaddressed && pager !== undefined && pager.following === undefined && !pager.later) return { outcome: "ended", stop: "no_following_page" };
  const following = unaddressed ? pager?.following : undefined;
  const control = following ?? named;
  progress.laterPageShown = pager?.later === true;
  if (pastDeadline(progress.deadline)) return { outcome: "timed_out", stop: "deadline" };
  await awaitPageLoadTurn(progress.deadline);
  if (pastDeadline(progress.deadline)) return { outcome: "timed_out", stop: "deadline" };
  const by = following === undefined ? "next" : "following";
  await progress.beforeFollow?.(by);
  const what = selector === undefined ? "the pager's Next" : JSON.stringify(selector);
  return await afterListChange(way, progress, control, `following ${what} to page ${progress.pagesRead + 1}`, by);
}

/**
 * The control a `next` move follows on this page, waiting up to
 * `PAGER_WAIT_MS` for one to appear; `"timed_out"` when the command's deadline
 * passed first.
 */
async function awaitNextControl(selector: string | undefined, progress: PaginationProgress): Promise<NextControlChoice | "timed_out" | undefined> {
  const look = (): NextControlChoice | undefined => nextControlOnPage(selector === undefined ? null : document.querySelector(selector), progress.shown);
  const seen: { choice: NextControlChoice | undefined } = { choice: look() };
  if (seen.choice !== undefined || !progress.shown[0]?.parentElement) return seen.choice;
  const outcome = await waitUntil(() => {
    seen.choice = look();
    return seen.choice !== undefined;
  }, PAGER_WAIT_MS, PAGER_POLL_MS, progress.deadline);
  return outcome === "timed_out" ? "timed_out" : seen.choice;
}
