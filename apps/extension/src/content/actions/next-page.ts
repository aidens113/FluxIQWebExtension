// The next-page verb, `web.dom.next_page` (contract C1): move a list to its
// next page, or say it has none. The move itself is the page's
// (`extraction/page-advance/`, granted as `deps.nextPage`); this turns its
// answer into the action result the domain lifts onto the wire.
//
// - `moved` succeeds with `nextPage: {outcome: "moved", by, page?}`.
// - `ended` succeeds too, with the stop word and `route: "ended"`: a list with
//   no next page is the loop over it ending, which Core routes down the node's
//   `ended` output, never the recovery ladder.
// - `failed` fails with the word and the closed set's code for it:
//   `list_unchanged` and `list_vanished` are OUTPUT_NOT_OBSERVED, `rate_limited`
//   RATE_LIMITED, `control_not_clickable` TARGET_NOT_ACTIONABLE, and
//   `page_fault` ACTION_FAILED. None is retried by the page's recovery loop:
//   this verb moves the page, and none of them is decided before the press.
// - A move out of time is `timed_out`, with no answer, as every verb's is.
//
// Nothing read off the page is in the result: the words, how the list moved,
// and the number its pager marks current.

import {
  WEB_AUTOMATION_FAILURE_CODES,
  webAutomationFailureRecord,
  type WebAutomationFailureCarrier,
  type WebAutomationFailureCode,
  type WebAutomationFailureRecord
} from "@fluxiq-web-extension/domain/client";
import type { WebAutomationNextPageFault } from "../../shared/protocol";
import type { BrowserActionCommand, BrowserActionResult } from "../types";
import type { ContentActionDependencies } from "./types";

const EXPECTED = "the list on its next page, or a list with no next page";

/** The closed set's code for each fault word (contract C1). */
const FAULT_CODES = {
  list_unchanged: WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED,
  list_vanished: WEB_AUTOMATION_FAILURE_CODES.OUTPUT_NOT_OBSERVED,
  rate_limited: WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED,
  control_not_clickable: WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_ACTIONABLE,
  page_fault: WEB_AUTOMATION_FAILURE_CODES.ACTION_FAILED
} as const satisfies Record<WebAutomationNextPageFault, WebAutomationFailureCode>;

/** A failed move, carrying the record its word maps to, which `deps.failure` reports as it is. */
class NextPageFault extends Error implements WebAutomationFailureCarrier {
  readonly failure: WebAutomationFailureRecord;

  constructor(stop: WebAutomationNextPageFault, reason: string) {
    super(reason);
    this.name = "NextPageFault";
    this.failure = webAutomationFailureRecord(FAULT_CODES[stop], { expected: EXPECTED, actual: `${stop}: ${reason}` });
  }
}

export async function nextPageAction(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number): Promise<BrowserActionResult> {
  const request = action.nextPage;
  if (!request) return deps.failure(action, new Error("web.dom.next_page needs nextPage parameters."), startedAt);
  try {
    const answer = await deps.nextPage(request, { timeoutMs: action.timeoutMs });
    switch (answer.outcome) {
      case "moved": {
        const page = answer.page === undefined ? "" : ` to page ${answer.page}`;
        const result = deps.success(action, startedAt, "The list moved to its next page.", { status: "passed", expected: EXPECTED, actual: `moved by ${answer.by}${page}` });
        return { ...result, nextPage: { outcome: "moved", by: answer.by, ...(answer.page === undefined ? {} : { page: answer.page }) } };
      }
      case "ended": {
        const result = deps.success(action, startedAt, "The list has no next page.", { status: "passed", expected: EXPECTED, actual: `ended: ${answer.stop}` });
        return { ...result, nextPage: { outcome: "ended", stop: answer.stop }, route: "ended" };
      }
      case "failed":
        return failed(action, deps, startedAt, answer.stop, answer.reason);
      default:
        return deps.timedOut(action, startedAt, answer.reason, { status: "failed", expected: EXPECTED, actual: "the time ran out before the move finished" });
    }
  } catch (error) {
    return failed(action, deps, startedAt, "page_fault", error instanceof Error ? error.message : "Moving the list to its next page failed.");
  }
}

function failed(action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number, stop: WebAutomationNextPageFault, reason: string): BrowserActionResult {
  return { ...deps.failure(action, new NextPageFault(stop, reason), startedAt), nextPage: { outcome: "failed", stop } };
}
