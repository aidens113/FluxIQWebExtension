// The top of the content script's command handling. Every command the
// background sends is routed first -- synchronously, from the message and this
// frame's place alone, reading nothing of the page -- so a frame a command is
// not for stays silent exactly as before. A command this frame would answer then
// waits for the document's own decision (`./check.ts`): an ordinary document
// answers it, and FluxIQ's own page answers with the refusal and does nothing
// else, no read, no act and nothing pushed.
//
// `fluxiq.ping` alone is answered at once in every document: it says only that
// a current script is listening, and a document that never answered it would be
// injected into again and again by the background's readiness check.

import { ownPageRefusalReply, ownPageUnconfirmedReply } from "../../shared/own-pages";
import type { OwnDocumentCheck } from "./check";

/** The answer a frame gives a command: called with the reply channel, it replies once, now or later. */
export type ContentAnswer = (sendResponse: (response: unknown) => void) => void;

/** A routed command: the answer, and whether it is the liveness ping no document withholds. */
export type ContentRoute = { readonly answer: ContentAnswer; readonly liveness?: true };

/** A `chrome.runtime.onMessage` listener over `route`, refusing every command in FluxIQ's own page. */
export function guardedCommandListener(
  route: (message: unknown) => ContentRoute | undefined,
  check: OwnDocumentCheck
): (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean {
  return (message, _sender, sendResponse) => {
    const routed = route(message);
    if (routed === undefined) return false;
    if (routed.liveness === true) {
      routed.answer(sendResponse);
      return false;
    }
    void check.verdict().then((verdict) => {
      if (verdict === "ordinary") routed.answer(sendResponse);
      else sendResponse(verdict === "own" ? ownPageRefusalReply() : ownPageUnconfirmedReply());
    });
    return true;
  };
}
