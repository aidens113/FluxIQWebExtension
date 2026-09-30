// Whether a press was refused by the page for going too fast.
//
// A page that limits how often an act may be made answers the press that goes
// over the limit with a notice rather than with the act: social-network-feed,
// on a fourth Confirm inside its fifteen-second window, opens an alertdialog --
// "You're going too fast ... You can try again in 12 seconds" -- whose OK closes
// it and confirms nothing. The click verb's post-condition for a button is the
// hit test, and the press did land, so until 2026-09-30 that refusal was
// reported as a success and a Flow confirming four requests read three accepted
// of four and the fourth as done.
//
// So after a press that is not a link, `actions/click.ts` watches for a short
// window for a layer that was not over the page before the press and whose own
// bounded words (`interference/layer-text.ts`) say the act was refused for
// going too fast (`interference/vocabulary.ts`, a closed phrase list). The
// layers are the ones the interference defence already finds
// (`interference/overlays.ts`), so the notice this reports is one the defence
// can close. What leaves the frame is only what was concluded: that a notice
// appeared, how long after the press, and the wait it named -- never its words.
//
// The wait is the notice's own "try again in N seconds" (or minutes), plus half
// a second so the retry lands after the page's window rather than on its edge,
// held to a minute. A notice that names no wait yields none, and Core's backoff
// decides.
//
// **The window costs a successful press, so it ends early whenever the press
// has plainly been answered otherwise.** A press the page accepted usually
// replaces what was pressed -- Confirm becomes "Request accepted" -- and a
// refused one leaves the control where it was, so the pressed element leaving
// the document ends the watch. So does the document starting to leave
// (`beforeunload`, `pagehide`, or the Navigation API's `navigate`): a button
// that submits a form navigates, and a result not sent before the document goes
// is a result lost, which is why a followed link is answered at once too.
//
// Nothing here presses anything. "Try again" on the notice does the refused act
// on the page's initiative; the node's own re-run, after the wait, does it on
// the Flow's.

import { boundedLayerText, isRateLimitLayerText, overlaysOverPage } from "./interference";

/** A press the page refused for going too fast, as far as it may be reported. */
export type RateLimitNotice = {
  /** How long after the press the notice was seen. */
  afterMs: number;
  /** The wait the notice named, plus a margin, in milliseconds; absent when it named none. */
  retryAfterMs?: number;
};

export type RateLimitWatch = {
  /**
   * Resolves with the notice once one is seen within `windowMs`, or `undefined`
   * when none is, or as soon as the press has been answered otherwise. Checks
   * once at once, so a notice the press's own handler opened is answered without
   * waiting. Stops the watch.
   */
  settle(windowMs: number): Promise<RateLimitNotice | undefined>;
  /** Stops without waiting; safe to call more than once. */
  stop(): void;
};

/** Where the watch reads the page: the layers painted over it, and a layer's own words. Injected by tests. */
export type RateLimitProbe = {
  layers(): readonly Element[];
  textOf(layer: Element): string;
};

/** How often the page is looked at while the window is open. */
const CHECK_INTERVAL_MS = 100;

/** Added to the named wait so the retry lands after the page's window, not on its edge. */
const RETRY_MARGIN_MS = 500;

/** The longest wait reported: a notice asking for longer is asking for more than a run gives one step. */
const RETRY_AFTER_MAX_MS = 60_000;

/** "try again in 12 seconds", "retry in 2 minutes", "wait 30 s": the number and its unit. */
const NAMED_WAIT = /\b(?:try again|retry|wait)(?: again)? (?:in |for )?(\d{1,6}) ?(s|secs?|seconds?|mins?|minutes?)\b/iu;

const PAGE_PROBE: RateLimitProbe = { layers: overlaysOverPage, textOf: boundedLayerText };

/**
 * Starts watching, from just before the press on `pressed`, for a rate-limit
 * notice the press opens. Made between the hover and the press, like the link
 * verb's in-place watch, so a layer already over the page is never taken for
 * the press's answer.
 */
export function watchRateLimitNotice(pressed: Element, probe: RateLimitProbe = PAGE_PROBE): RateLimitWatch {
  const startedAt = Date.now();
  const before = new Set(probe.layers());
  let leaving = false;
  let wake: (() => void) | undefined;
  const leave = (): void => {
    leaving = true;
    wake?.();
  };
  const unlisten = listenForLeaving(pressed, leave);
  let stopped = false;
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    unlisten();
  };

  /** The notice, `"answered"` when the press was plainly answered otherwise, or `undefined` to keep looking. */
  const check = (): RateLimitNotice | "answered" | undefined => {
    for (const layer of probe.layers()) {
      if (before.has(layer)) continue;
      const text = probe.textOf(layer);
      if (!isRateLimitLayerText(text)) continue;
      const retryAfterMs = namedWaitMs(text);
      return { afterMs: Date.now() - startedAt, ...(retryAfterMs === undefined ? {} : { retryAfterMs }) };
    }
    return leaving || !pressed.isConnected ? "answered" : undefined;
  };

  /**
   * A notice seen before its wait could be read. It is the answer if the window
   * closes first; until then the watch keeps looking, because a countdown the
   * page fills in a moment later is the wait Core needs, and without it Core
   * retries at once into the same refusal (`run-munq51ik-a7ebd077`).
   */
  let waitless: RateLimitNotice | undefined;
  /** Whether this sighting ends the watch now: anything but a notice still missing its wait. */
  const settles = (found: RateLimitNotice | "answered" | undefined): boolean => {
    if (found === undefined) return false;
    if (found !== "answered" && found.retryAfterMs === undefined) {
      waitless ??= found;
      return false;
    }
    return true;
  };
  const answer = (found: RateLimitNotice | "answered" | undefined): RateLimitNotice | undefined =>
    found !== undefined && found !== "answered" ? found : waitless;

  return {
    stop,
    settle(windowMs) {
      const immediate = check();
      if (settles(immediate) || windowMs <= 0) {
        stop();
        return Promise.resolve(answer(immediate));
      }
      return new Promise((resolve) => {
        const finish = (found: RateLimitNotice | "answered" | undefined): void => {
          clearInterval(poll);
          clearTimeout(deadline);
          wake = undefined;
          stop();
          resolve(answer(found));
        };
        const look = (): void => {
          const found = check();
          if (settles(found)) finish(found);
        };
        wake = look;
        const poll = setInterval(look, CHECK_INTERVAL_MS);
        // One last look at the deadline, so a notice painted inside the final
        // interval is not reported as none.
        const deadline = setTimeout(() => finish(check()), windowMs);
      });
    }
  };
}

/** The wait a notice names, with the margin, held to the bound; `undefined` when it names none. */
function namedWaitMs(text: string): number | undefined {
  const match = NAMED_WAIT.exec(text);
  if (!match) return undefined;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return undefined;
  const unitMs = /^m/iu.test(match[2] ?? "") ? 60_000 : 1_000;
  return Math.min(amount * unitMs + RETRY_MARGIN_MS, RETRY_AFTER_MAX_MS);
}

/**
 * Listens on the pressed element's window for the document starting to leave,
 * and returns how to stop listening. A window without the Navigation API still
 * reports `beforeunload` and `pagehide`; an element with no window reports
 * nothing, which only means the whole window is waited.
 */
function listenForLeaving(pressed: Element, leave: () => void): () => void {
  const view = pressed.ownerDocument?.defaultView as (Window & { navigation?: EventTarget }) | null | undefined;
  if (!view || typeof view.addEventListener !== "function") return () => undefined;
  const navigation = view.navigation && typeof view.navigation.addEventListener === "function" ? view.navigation : undefined;
  view.addEventListener("beforeunload", leave);
  view.addEventListener("pagehide", leave);
  navigation?.addEventListener("navigate", leave);
  return () => {
    view.removeEventListener("beforeunload", leave);
    view.removeEventListener("pagehide", leave);
    navigation?.removeEventListener("navigate", leave);
  };
}
