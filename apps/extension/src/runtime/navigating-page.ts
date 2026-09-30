// Whether a message to a tab was refused because its page was navigating.
//
// `executeAction` answers asynchronously (`content/message-handler.ts`), so a
// document that unloads before it answers closes the channel, and a document
// not yet listening refuses the send. Chrome words both the same way every
// time. `action-runner.ts` re-sends a read that met one; `click-landing.ts`
// judges a click that met one by where its tab landed.

/**
 * Chrome's words for a message that was delivered and whose document then
 * unloaded before it answered: the page went under it.
 */
const UNLOADED_UNDER_IT = /message (port|channel) closed before a response was received/i;

/**
 * Chrome's words for a send that found no listener, and for a document that
 * unloaded before it answered.
 */
const NAVIGATING_PAGE_ERRORS = [/Receiving end does not exist/i, UNLOADED_UNDER_IT];

/** True when the error is a send refused because the page was navigating. */
export function metNavigatingPage(error: unknown): boolean {
  return error instanceof Error && NAVIGATING_PAGE_ERRORS.some((pattern) => pattern.test(error.message));
}

/**
 * True only when the message was delivered and its page unloaded before
 * answering. A send that found no listener ("Receiving end does not exist")
 * never reached the page, so it is not this: a click refused that way was not
 * made, whatever the tab then did.
 */
export function unloadedUnderDeliveredMessage(error: unknown): boolean {
  return error instanceof Error && UNLOADED_UNDER_IT.test(error.message);
}
