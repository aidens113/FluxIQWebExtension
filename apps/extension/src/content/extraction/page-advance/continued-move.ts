// The page's half of carrying `web.dom.next_page` across documents
// (`shared/extraction-continuation.ts` says why and how): the move granted to
// the verb when the worker sent a continuation beside the command, which marks
// each press to the worker before making it, and -- in a document a press
// loaded -- goes on from the worker's mark.
//
// A mark the worker does not take -- a sender with no worker behind it, such as
// the content harness -- is not a failure of the move. The move goes on as it
// would have without one; what is lost is only an answer from a document the
// press loads.

import { PAGE_MOVE_MARK_MESSAGE, readPageMoveMark, type PageMoveContinuation, type PageMoveMark, type PageMoveMarkMessage } from "../../../shared/extraction-continuation";
import type { PageMove } from "./move-outcome";
import { movePage } from "./move-page";

/**
 * The move for a command that carried `continuation`, or the plain one when it
 * carried none. A continuation whose resume is not a mark is refused rather
 * than pressed from the start, because pressing again would move the list a
 * second page.
 *
 * The same message member carries a list read's continuation
 * (`action-runtime/extraction-continuation.ts`); each verb is granted the
 * capability its own command uses, and a capability built from the other's
 * continuation is refused only if it is called, which it never is.
 */
export function pageMoveFor(continuation: unknown): PageMove {
  if (continuation === undefined) return movePage;
  const { token, resume } = (typeof continuation === "object" && continuation !== null ? continuation : {}) as Partial<PageMoveContinuation>;
  const mark = resume === undefined ? undefined : readPageMoveMark(resume);
  if (typeof token !== "string" || token === "" || (resume !== undefined && mark === undefined)) {
    return () => Promise.reject(new Error("The next-page continuation the worker sent is not one this page can go on from."));
  }
  return (request, options = {}) => movePage(request, { ...options, resume: mark, mark: (made) => sendMark(token, made) });
}

/** Hands the mark to the worker and waits until it has it, or has said it will not take it. */
async function sendMark(token: string, mark: PageMoveMark): Promise<void> {
  const message: PageMoveMarkMessage = { type: PAGE_MOVE_MARK_MESSAGE, token, mark };
  try {
    await chrome.runtime.sendMessage(message);
  } catch (error) {
    // No receiver: the move goes on without a continuation (see the header).
    if (!isNoReceiver(error)) throw error;
  }
}

function isNoReceiver(error: unknown): boolean {
  return error instanceof Error && /Receiving end does not exist|Could not establish connection/iu.test(error.message);
}
