// Pressing a list's load-more control, then waiting until an item appears that
// was not shown before, or the control detaches. A load that failed and
// offered a Retry beside the control has it pressed, at most twice
// (`../load-retry.ts`).
//
// **A list whose loader asked to wait has not ended** (t762). A press answered
// with the loader's notice ("Please wait a few moments before you try again",
// "Try again in 4s") brings no item; the step then waits as the notice asks, or
// presses the retry control it offers once it shows, and presses again, within
// the node's retries (`./loader-pause/`). A list still paused after them fails
// `rate_limited` with the notice's words, not `list_unchanged` and not ended.
//
// **A control under an open layer is not pressed** (t762): the page's own way out
// is pressed first and the control is covered, `control_not_clickable`, where
// the layer stays (`./covered-press/`). The same holds for Next and numbered pages.
//
// A disabled or `aria-disabled="true"` control is the list ending. An absent
// or unrendered control is first watched briefly, then the list is scrolled
// within its ordinary bound: some lists expose the button after initial
// scroll-loaded batches. No growth and no revealed control ends the list.
// Guildline's Sent invitations keeps its "Show
// more" with `hidden` after the last page; until 2026-10-01 every read of it
// either stopped truncated at its page bound or pressed the hidden control and
// failed ten seconds later as a page that ignored it. A live control that
// yields nothing in ten seconds fails the move, as `next` does.
//
// A press the page ignored outright is made once more, as the click verb makes
// one (`../../actions/click.ts`, `../../action-runtime/ignored-press/`): the
// press is watched for `IGNORED_PRESS_WINDOW_MS` for any sign the page answered
// it -- a request begun, a change in the control's section, a navigation, a
// focus move -- and only when none came, no new item showed and the control is
// still there is it pressed again, once. Photo-social's comment thread swallows
// the first press its Load more gets, as a list that has not hydrated does, so
// a Next page on it failed `list_unchanged` ten seconds later where a person
// would simply have pressed again (t755, `run-mvebbeom-a60886e1`). Any sign at
// all means it is never pressed again: a second press on a press that began a
// load would be a second load.
//
// Which control is pressed is decided on the page each time
// (`./appending-control.ts`): the list's own load-more control found around it,
// wherever it has moved, and the authored selector only where none is found
// and it names no item of the list. A position saved while the control sat in
// the fourteenth slot names a comment once a batch has loaded.

import { pressAgain, watchIgnoredPress } from "../../action-runtime/ignored-press";
import type { WebAutomationNextPageWay } from "../../../shared/protocol";
import { waitUntil, type WaitOutcome } from "../list-wait";
import { offeredLoadRetry } from "../load-retry";
import { isDisabled } from "../pager-reading";
import { PAGER_POLL_MS } from "./follow-next";
import { clickable, LIST_CHANGE_POLL_MS, LIST_CHANGE_TIMEOUT_MS, pastDeadline } from "./list-change";
import { loadMoreControlOnPage } from "./appending-control";
import { clearCover } from "./covered-press";
import { passSessionWall, waitOutLoaderPause } from "./loader-pause";
import { loaderNoticeOf } from "../read-coverage";
import { PaginationFault } from "./pagination-fault";
import { scrollForMore } from "./scroll-for-more";
import type { PageStep, PaginationProgress } from "./types";

/** How many times one load-more press may have its failure retried through the Retry the page offered. */
const LOAD_RETRIES = 2;
/**
 * How long a load-more control that is in the page but not rendered is watched
 * for coming back before the list counts as ended: a page may hide it while it
 * settles a load, and one that has ended its list pays this once.
 */
const HIDDEN_CONTROL_GRACE_MS = 1_000;
/** How long a press is watched for any answer before it counts as ignored and is made once more: the click verb's window (header). */
const IGNORED_PRESS_WINDOW_MS = 800;

/** Presses the way's load-more control; `bound`, when there is one, is the pages the read may read. */
export async function pressLoadMore(way: Extract<WebAutomationNextPageWay, { mode: "loadMore" }>, progress: PaginationProgress, bound: number | undefined): Promise<PageStep> {
  const onPage = (): Element | null => loadMoreControlOnPage(document.querySelector(way.control), progress.shown) ?? null;
  let found = await renderedLoadMore(onPage, progress);
  if (found === "timed_out") return { outcome: "timed_out", stop: "deadline" };
  if (!found) {
    // Some lists load on scroll before exposing their button. Its absence is
    // not proof that the list ended; a bounded scroll may bring another batch
    // or reveal the button. Visible controls still take precedence below.
    if (bound !== undefined && progress.pagesRead >= bound) return { outcome: "truncated", stop: "page_limit" };
    const scrolled = await scrollForMore(progress, undefined);
    if (scrolled.outcome !== "ended") return scrolled;
    const now = onPage();
    if (!now || !isRendered(now)) return { outcome: "ended", stop: "control_absent" };
    found = now;
  }
  if (isDisabled(found)) return { outcome: "ended", stop: "control_disabled" };
  if (bound !== undefined && progress.pagesRead >= bound) return { outcome: "truncated", stop: "page_limit" };
  const control = clickable(found, way.control);
  await clearCover(control, progress.deadline);
  if (pastDeadline(progress.deadline)) return { outcome: "timed_out", stop: "deadline" };
  await progress.beforeFollow?.("loadMore");
  await pressHeard(control, progress);
  let outcome = await waitForMoreItems(control, progress);
  // A loader that answered the press with a notice to wait has paused the list; it has not ended (header).
  for (let pauses = 0, walls = 0; outcome === "unchanged" && control.isConnected; pauses += 1) {
    // A session check under the list is passed by its plain way on, not taken for the end (`./loader-pause/pass-session-wall.ts`, t765).
    const walled = await passSessionWall(progress, walls);
    if (walled === "timed_out") return { outcome: "timed_out", stop: "deadline" };
    if (walled === "passed") {
      walls += 1;
      pauses -= 1;
      if (progress.hasUnreadItem()) outcome = "changed";
      else outcome = await waitForMoreItems(control, progress);
      continue;
    }
    const paused = await waitOutLoaderPause(progress, pauses);
    if (paused === "timed_out") return { outcome: "timed_out", stop: "deadline" };
    if (paused === "clear") break;
    if (progress.hasUnreadItem()) {
      outcome = "changed";
      break;
    }
    if (paused !== "retried") await pressHeard(control, progress);
    outcome = await waitForMoreItems(control, progress);
  }
  if (outcome === "unchanged") {
    throw new PaginationFault("list_unchanged", `No new item appeared within ${LIST_CHANGE_TIMEOUT_MS}ms of pressing ${JSON.stringify(way.control)} for page ${progress.pagesRead + 1}.`);
  }
  return outcome === "changed" ? { outcome: "advanced", by: "loadMore" } : { outcome: "timed_out", stop: "deadline" };
}

/**
 * Presses `control`, and once more when the page did nothing whatever about the
 * first press (header). Nothing is waited for when the press already brought a
 * new item or took the control away.
 */
async function pressHeard(control: HTMLElement, progress: PaginationProgress): Promise<void> {
  const watch = watchIgnoredPress(control);
  try {
    control.click();
    if (progress.hasUnreadItem() || !control.isConnected) return;
    const windowMs = progress.deadline === undefined ? IGNORED_PRESS_WINDOW_MS : Math.max(0, Math.min(IGNORED_PRESS_WINDOW_MS, progress.deadline - Date.now()));
    const answer = await watch.settle(windowMs);
    if (!pressAgain(answer.seen, 0) || progress.hasUnreadItem() || !control.isConnected || pastDeadline(progress.deadline)) return;
  } finally {
    watch.stop();
  }
  control.click();
}

/**
 * The load-more control, when the page has one and renders it; `undefined`
 * when it is absent, or present and still not rendered after
 * `HIDDEN_CONTROL_GRACE_MS` -- to a person, a hidden control is no control.
 * `"timed_out"` when the command's deadline passed during that grace.
 */
async function renderedLoadMore(onPage: () => Element | null, progress: PaginationProgress): Promise<Element | "timed_out" | undefined> {
  const seen: { control: Element | null } = { control: onPage() };
  if (!seen.control || isRendered(seen.control)) return seen.control ?? undefined;
  const outcome = await waitUntil(() => {
    seen.control = onPage();
    return seen.control !== null && isRendered(seen.control);
  }, HIDDEN_CONTROL_GRACE_MS, PAGER_POLL_MS, progress.deadline);
  if (outcome === "timed_out") return "timed_out";
  return outcome === "changed" ? (seen.control ?? undefined) : undefined;
}

/**
 * Whether the page draws `control`: no `hidden` attribute, and a box. An
 * element that cannot say where it is (a test's stand-in) counts as drawn.
 */
function isRendered(control: Element): boolean {
  if (control.getAttribute("hidden") !== null) return false;
  return typeof control.getClientRects !== "function" || control.getClientRects().length > 0;
}

/**
 * Waits for the press to bring an item that was not shown before, or for the
 * control to leave. A load that failed and put a Retry beside the control
 * (`../load-retry.ts`) has that Retry pressed, at most `LOAD_RETRIES` times,
 * and each press gets the full window again.
 */
async function waitForMoreItems(control: HTMLElement, progress: PaginationProgress): Promise<WaitOutcome> {
  let retried = 0;
  for (;;) {
    const offered: { retry: HTMLElement | undefined } = { retry: undefined };
    const outcome = await waitUntil(() => {
      if (progress.hasUnreadItem() || !control.isConnected) return true;
      offered.retry = retried < LOAD_RETRIES ? offeredLoadRetry(control) : undefined;
      // The loader's notice to wait is the page's answer: no new item is coming for now (`./loader-pause/`).
      return offered.retry !== undefined || loaderNoticeOf(progress.shown) !== undefined;
    }, LIST_CHANGE_TIMEOUT_MS, LIST_CHANGE_POLL_MS, progress.deadline);
    if (outcome === "changed" && !offered.retry && control.isConnected && !progress.hasUnreadItem()) return "unchanged";
    if (outcome !== "changed" || !offered.retry) return outcome;
    retried += 1;
    offered.retry.click();
  }
}
