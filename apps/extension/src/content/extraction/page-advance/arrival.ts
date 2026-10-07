// The document a `web.dom.next_page` press loaded, asked whether the list
// arrived. The press took the script that made it away, so the worker sends
// the same command again with the mark the press left
// (`shared/extraction-continuation.ts`), and this answers for the press: the
// list's first item is here, so the list moved; or the server refused the
// landing, which is waited out and reloaded while the step can afford it
// (`./refused-page.ts`); or the page holds none of the list, which is the list
// lost, not ended. Nothing is pressed here.

import type { WebAutomationNextPageRequest } from "../../../shared/protocol";
import type { PageMoveMark } from "../../../shared/extraction-continuation";
import { waitUntil } from "../list-wait";
import { failedMove, type PageMoveOptions, type PageMoveOutcome } from "./move-outcome";
import { pageShownNow } from "./shown-page";
import { BROWSER_PAGE_HOST, pageRefusalOf, refusedPageWaitMs, type PageRefusal } from "./refused-page";

/** How long the landing is given to show the list's first item: a page a press loaded may draw its results after it loads. */
const ARRIVAL_WINDOW_MS = 10_000;
const LIST_POLL_MS = 50;

/** The items of `item` once at least one shows, `[]` when none does within `windowMs`, or `"timed_out"` when the deadline came first. */
export async function awaitListItems(item: string, windowMs: number, deadline: number | undefined): Promise<Element[] | "timed_out"> {
  const outcome = await waitUntil(() => document.querySelector(item) !== null, windowMs, LIST_POLL_MS, deadline);
  if (outcome === "timed_out") return "timed_out";
  return Array.from(document.querySelectorAll(item));
}

/** Answers for the press `resume` marks: see the header. */
export async function arriveAfterMove(request: WebAutomationNextPageRequest, resume: PageMoveMark, deadline: number | undefined, options: PageMoveOptions): Promise<PageMoveOutcome> {
  const host = options.host ?? BROWSER_PAGE_HOST;
  const spent = { retries: resume.refusals?.retries ?? 0, rateLimits: resume.refusals?.rateLimits ?? 0 };
  // A landing the server refused, or that lost the list with no status to say
  // why, is reloaded while the step can afford it; the reload takes this script
  // with it, so this returns only when the step stops on the refused page.
  const refused = async (refusal: PageRefusal): Promise<PageMoveOutcome> => {
    const remaining = deadline === undefined ? undefined : deadline - Date.now();
    const waitMs = refusedPageWaitMs(refusal, spent, remaining, options.mark !== undefined);
    if (waitMs !== undefined && options.mark !== undefined) {
      await host.pause(waitMs);
      spent.retries += 1;
      if (refusal !== "unavailable") spent.rateLimits += 1;
      await options.mark({ by: resume.by, refusals: { ...spent } });
      await host.reload();
    }
    return refusal === "rate_limited"
      ? failedMove("rate_limited", "The page the list moved to was refused as too fast, and waiting it out did not bring the list back.")
      : failedMove("list_vanished", `The page the list moved to ${refusal === "unavailable" ? "was refused as unavailable" : "showed none of the list"}, and reloading it did not bring the list back.`);
  };
  const status = host.status();
  // Unless the server refused the landing, which no wait for a list can change, the list is waited for.
  const known = status === undefined ? undefined : pageRefusalOf(status);
  if (known !== undefined) return await refused(known);
  const items = await awaitListItems(request.item, ARRIVAL_WINDOW_MS, deadline);
  if (items === "timed_out") return { outcome: "timed_out", reason: "The time ran out before the page the list moved to showed it." };
  if (items.length > 0) {
    const page = pageShownNow(request.pagination, request.item);
    return { outcome: "moved", by: resume.by, ...(page === undefined ? {} : { page }) };
  }
  if (status === undefined) return await refused("unexplained");
  return failedMove("list_vanished", `The page the list moved to shows no item matching ${JSON.stringify(request.item)}.`);
}
