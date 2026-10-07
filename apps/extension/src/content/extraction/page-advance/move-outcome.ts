// What one `web.dom.next_page` step answers on the page (`./move-page.ts`),
// before the verb turns it into an action result (`content/actions/next-page.ts`):
// contract C1's answer, a sentence for each failure, and a step that ran out of
// time. Its words are the domain's own closed sets, asked of the domain's
// reader, so the page cannot answer a word the wire would drop.

import { webAutomationNextPageAnswerValue } from "@fluxiq-web-extension/domain/client";
import type { WebAutomationNextPageBy, WebAutomationNextPageEnd, WebAutomationNextPageFault, WebAutomationNextPageRequest } from "../../../shared/protocol";
import type { PageMoveMark } from "../../../shared/extraction-continuation";
import type { RefusedPageHost } from "./refused-page";
import type { PaginationStop } from "./types";

/** One step's answer: moved, ended, failed with its word and a sentence, or out of time. */
export type PageMoveOutcome =
  | { outcome: "moved"; by: WebAutomationNextPageBy; page?: number | undefined }
  | { outcome: "ended"; stop: WebAutomationNextPageEnd }
  | { outcome: "failed"; stop: WebAutomationNextPageFault; reason: string }
  | { outcome: "timed_out"; reason: string };

export type PageMoveOptions = {
  /** The command's `timeoutMs`, which bounds the whole step, every document it reaches included. */
  timeoutMs?: number | undefined;
  /** This document was reached by a press the worker saw marked: answer whether the list arrived, pressing nothing. */
  resume?: PageMoveMark | undefined;
  /** Hands the worker a mark and waits until it has it: before a press, and before a refused landing's reload. Absent, nothing can carry the step into another document. */
  mark?: ((mark: PageMoveMark) => Promise<void>) | undefined;
  /** The document's status, pause and reload: the browser's own unless a test stands them in. */
  host?: RefusedPageHost | undefined;
};

/** The capability the verb is granted: one step of the list to its next page. */
export type PageMove = (request: WebAutomationNextPageRequest, options?: PageMoveOptions) => Promise<PageMoveOutcome>;

export function failedMove(stop: WebAutomationNextPageFault, reason: string): PageMoveOutcome {
  return { outcome: "failed", stop, reason };
}

/**
 * The answer for a step that stopped on `stop` without moving: `ended` when
 * the word is a list's end, otherwise `failed` with the word when it is one of
 * C1's faults, or `page_fault` for any other.
 */
export function stoppedMove(stop: PaginationStop, reason: string): PageMoveOutcome {
  const ended = webAutomationNextPageAnswerValue({ outcome: "ended", stop });
  if (ended?.outcome === "ended") return ended;
  const failed = webAutomationNextPageAnswerValue({ outcome: "failed", stop });
  return failedMove(failed?.outcome === "failed" ? failed.stop : "page_fault", reason);
}
