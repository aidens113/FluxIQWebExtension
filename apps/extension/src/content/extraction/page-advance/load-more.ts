// Pressing a list's load-more control, then waiting until an item appears that
// was not shown before, or the control detaches. A load that failed and
// offered a Retry beside the control has it pressed, at most twice
// (`../load-retry.ts`).
//
// An absent, disabled or `aria-disabled="true"` control is the list ending,
// and so is one still in the page but not rendered -- the `hidden` attribute,
// or no box at all -- once it has stayed so for a second, for a page that
// hides it only while it settles. Guildline's Sent invitations keeps its "Show
// more" with `hidden` after the last page; until 2026-10-01 every read of it
// either stopped truncated at its page bound or pressed the hidden control and
// failed ten seconds later as a page that ignored it. A live control that
// yields nothing in ten seconds fails the move, as `next` does.

import type { WebAutomationNextPageWay } from "../../../shared/protocol";
import { waitUntil, type WaitOutcome } from "../list-wait";
import { offeredLoadRetry } from "../load-retry";
import { isDisabled } from "../pager-reading";
import { PAGER_POLL_MS } from "./follow-next";
import { clickable, LIST_CHANGE_POLL_MS, LIST_CHANGE_TIMEOUT_MS, pastDeadline } from "./list-change";
import { PaginationFault } from "./pagination-fault";
import type { PageStep, PaginationProgress } from "./types";

/** How many times one load-more press may have its failure retried through the Retry the page offered. */
const LOAD_RETRIES = 2;
/**
 * How long a load-more control that is in the page but not rendered is watched
 * for coming back before the list counts as ended: a page may hide it while it
 * settles a load, and one that has ended its list pays this once.
 */
const HIDDEN_CONTROL_GRACE_MS = 1_000;

/** Presses the way's load-more control; `bound`, when there is one, is the pages the read may read. */
export async function pressLoadMore(way: Extract<WebAutomationNextPageWay, { mode: "loadMore" }>, progress: PaginationProgress, bound: number | undefined): Promise<PageStep> {
  const found = await renderedLoadMore(way.control, progress);
  if (found === "timed_out") return { outcome: "timed_out", stop: "deadline" };
  if (!found) return { outcome: "ended", stop: "control_absent" };
  if (isDisabled(found)) return { outcome: "ended", stop: "control_disabled" };
  if (bound !== undefined && progress.pagesRead >= bound) return { outcome: "truncated", stop: "page_limit" };
  const control = clickable(found, way.control);
  if (pastDeadline(progress.deadline)) return { outcome: "timed_out", stop: "deadline" };
  await progress.beforeFollow?.("loadMore");
  control.click();
  const outcome = await waitForMoreItems(control, progress);
  if (outcome === "unchanged") {
    throw new PaginationFault("list_unchanged", `No new item appeared within ${LIST_CHANGE_TIMEOUT_MS}ms of pressing ${JSON.stringify(way.control)} for page ${progress.pagesRead + 1}.`);
  }
  return outcome === "changed" ? { outcome: "advanced", by: "loadMore" } : { outcome: "timed_out", stop: "deadline" };
}

/**
 * The load-more control, when the page has one and renders it; `undefined`
 * when it is absent, or present and still not rendered after
 * `HIDDEN_CONTROL_GRACE_MS` -- to a person, a hidden control is no control.
 * `"timed_out"` when the command's deadline passed during that grace.
 */
async function renderedLoadMore(selector: string, progress: PaginationProgress): Promise<Element | "timed_out" | undefined> {
  const seen: { control: Element | null } = { control: document.querySelector(selector) };
  if (!seen.control || isRendered(seen.control)) return seen.control ?? undefined;
  const outcome = await waitUntil(() => {
    seen.control = document.querySelector(selector);
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
      return offered.retry !== undefined;
    }, LIST_CHANGE_TIMEOUT_MS, LIST_CHANGE_POLL_MS, progress.deadline);
    if (outcome !== "changed" || !offered.retry) return outcome;
    retried += 1;
    offered.retry.click();
  }
}
