// Whether the page has finished what it set in motion, asked from the content
// script (task speed S10, t893): the page world's count of the work the page
// scheduled for itself (`page-world/page-work/`), read through the function
// the worker also injects (`shared/scheduled-work-settled.ts`).
//
// Two waits end on it instead of on a fixed window. A one-page list read gave
// the list 900 ms to stop growing, and 900 ms more after scrolling its end into
// view (`extraction/page-render.ts`, `extraction/list-wait.ts`): on
// local-classifieds those windows were most of a replayed read's 2.3 s, though
// the page had finished long before they closed (`run-mwaqjkxp-ae3d862c`, s12).
// And an action on a page whose address moved in place since the last action
// waits here for the page's redraw (`./address-settle.ts`).
//
// `afterFrames` first lets the page draw: a scroll's `scroll` event and an
// `IntersectionObserver`'s callback -- the way a feed notices its end came into
// view -- arrive with the next frames, not at once, and neither is work the
// page world counts until the handler begins it. Two animation frames have run
// both. A hidden page draws no frames, and a page with no page world counting
// cannot say: both answer `false`, and the caller's window decides as before.

import { PAGE_WORK_BUSY_EVENT, PAGE_WORK_DRAINED_EVENT, PAGE_WORK_WATCHED_EVENT } from "../../../shared/scheduled-work-event";
import { pageSettledInPage } from "../../../shared/scheduled-work-settled";

/** A question put to the page: whether it settles before `endsAt`, and the way to stop asking. */
export type PageQuiet = {
  /** True once the page's work is done and its document held still a task; false where it cannot say, or at `endsAt`. */
  readonly settled: Promise<boolean>;
  /** Stops asking: `settled` answers false if it had not answered. Safe to call more than once. */
  stop(): void;
};

/** Frames a page draws before its scroll handlers and intersection callbacks have all run (see the header). */
const FRAMES_BEFORE_ASKING = 2;

/** Asks whether the page settles before `endsAt` (epoch ms), after `afterFrames` frames when asked to. */
export function askPageQuiet(endsAt: number, options: { afterFrames?: boolean } = {}): PageQuiet {
  const controller = new AbortController();
  if (typeof window === "undefined" || typeof document === "undefined" || typeof MutationObserver === "undefined") {
    return { settled: Promise.resolve(false), stop: () => undefined };
  }
  const deadline = setTimeout(() => controller.abort(), Math.max(0, endsAt - Date.now()));
  const settled = (async () => {
    try {
      if (options.afterFrames === true && !await framesDrawn(FRAMES_BEFORE_ASKING, controller.signal)) return false;
      return await pageSettledInPage(PAGE_WORK_WATCHED_EVENT, PAGE_WORK_BUSY_EVENT, PAGE_WORK_DRAINED_EVENT, controller.signal);
    } finally {
      clearTimeout(deadline);
    }
  })();
  return { settled, stop: () => controller.abort() };
}

/** Waits for `count` animation frames; false when the frames do not come before `signal` stops the wait. */
function framesDrawn(count: number, signal: AbortSignal): Promise<boolean> {
  if (typeof requestAnimationFrame !== "function") return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    let left = count;
    let frame: number | undefined;
    const stopped = (): void => {
      if (frame !== undefined && typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
      resolve(false);
    };
    if (signal.aborted) {
      resolve(false);
      return;
    }
    signal.addEventListener("abort", stopped, { once: true });
    const next = (): void => {
      left -= 1;
      if (left > 0) {
        frame = requestAnimationFrame(next);
        return;
      }
      signal.removeEventListener("abort", stopped);
      resolve(true);
    };
    frame = requestAnimationFrame(next);
  });
}
