// Whether a press's answer is complete (task speed S10): every request the press
// began has answered, or, when it began none, every piece of work its own
// handlers started has run (`work-mark.ts`, `page-world/press-work/`). The page
// world tells all of it (`shared/request-start-event.ts`,
// `shared/press-work-event.ts`), and announces each request's answer on the
// window, so a watch waiting for a press's answer -- a refusal notice, a robot
// check, a section that may turn back -- can end the moment it is complete,
// instead of at a fixed window.
//
// Since 2026-11-11 the press's own work counts too: a press that opens a
// dialog or a list in place, with a handler that runs and is done
// (local-classifieds' location chip and its sort box), began no request, and
// waited out every window although nothing it started could still answer
// (`run-mwanaq9u-eb3ca953`, 1.15 s and 0.83 s in the content script).
//
// A press whose requests are still out, whose handlers are still at work, or
// that the page world cannot follow (an async handler, a WebSocket message, a
// fetch with no resource entry, no page world, wrappers the page replaced) is
// never complete, so its watches keep the window they had.

import { REQUEST_ANSWERED_EVENT } from "../../../shared/request-start-event";
import { markRequestStarts, type RequestStartMark } from "./request-start-mark";
import { markPressWork } from "./work-mark";

/** A press-work mark as `work-mark.ts` makes one. */
type WorkMark = NonNullable<ReturnType<typeof markPressWork>>;

export type PressAnswered = {
  /** Whether the press's answer is complete: its requests all answered, or, having begun none, its own work all run. */
  answered(): boolean;
  /** Whether every piece of work the press's own handlers started has run, as the page world followed it. */
  workDone(): boolean;
  /** Calls `listener` each time one of the page's requests answers; answers the way to stop. */
  onAnswer(listener: () => void): () => void;
  /** Releases the press-work mark; safe to call more than once. */
  stop(): void;
};

/** Watches `pressed`'s requests and work from now. Undefined where the page world cannot say. Made just before the press. */
export function watchPressAnswered(
  pressed: Element,
  mark: RequestStartMark | undefined = markRequestStarts(pressed),
  work: WorkMark | undefined = markPressWork(pressed)
): PressAnswered | undefined {
  const pending = mark?.pendingSince;
  if (mark === undefined || pending === undefined) {
    work?.stop();
    return undefined;
  }
  const view = pressed.ownerDocument?.defaultView ?? undefined;
  const workDone = (): boolean => work?.state() === "idle";
  return {
    answered: () => {
      if (mark.healthy?.() !== true) return false;
      return mark.begunSince() ? !pending() : workDone();
    },
    workDone,
    onAnswer(listener) {
      if (!view) return () => undefined;
      view.addEventListener(REQUEST_ANSWERED_EVENT, listener);
      return () => view.removeEventListener(REQUEST_ANSWERED_EVENT, listener);
    },
    stop: () => work?.stop()
  };
}
