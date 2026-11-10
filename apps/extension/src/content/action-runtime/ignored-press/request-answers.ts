// Whether the server has answered a press: the press began at least one
// request, and every request it began has answered (task speed S10). The page
// world tells both (`shared/request-start-event.ts`), and announces each answer
// on the window, so a watch waiting for a press's answer -- a refusal notice, a
// robot check -- can end the moment the server has answered, instead of at a
// fixed window. A press that began no request, a page world that is missing or
// whose wrappers the page replaced, and a request that cannot be told answered
// (a WebSocket message, a fetch with no resource entry) never read as answered,
// so their watches keep the window they had.

import { REQUEST_ANSWERED_EVENT } from "../../../shared/request-start-event";
import { markRequestStarts, type RequestStartMark } from "./request-start-mark";

export type PressAnswered = {
  /** Whether the press began a request and every one it began has answered. */
  answered(): boolean;
  /** Calls `listener` each time one of the page's requests answers; answers the way to stop. */
  onAnswer(listener: () => void): () => void;
};

/** Watches `pressed`'s requests from now. Undefined where the page world cannot say. Made just before the press. */
export function watchPressAnswered(pressed: Element, mark: RequestStartMark | undefined = markRequestStarts(pressed)): PressAnswered | undefined {
  const pending = mark?.pendingSince;
  if (mark === undefined || pending === undefined) return undefined;
  const view = pressed.ownerDocument?.defaultView ?? undefined;
  return {
    answered: () => mark.healthy?.() === true && mark.begunSince() && !pending(),
    onAnswer(listener) {
      if (!view) return () => undefined;
      view.addEventListener(REQUEST_ANSWERED_EVENT, listener);
      return () => view.removeEventListener(REQUEST_ANSWERED_EVENT, listener);
    }
  };
}
