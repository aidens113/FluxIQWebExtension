// Whether a press put a robot check up on the page, and whether it went away
// by itself.
//
// A press that is not a link can be answered with a check drawn in place, no
// navigation at all: company-website's quote form answers "Send request" with
// "Checking you are human..." in its modal and, 2.2 s later, a "Confirm you
// are human" box. The click verb's post-condition for a button is the hit
// test, and the press did land, so until 2026-09-30 that was a successful
// click and the next step met a page only a person could answer.
//
// So `actions/click.ts` watches, beside the rate-limit watch and within the
// same window, for the page's robot-check reading (`challenge-evidence.ts`'s
// `robotCheckIn`) to change after the press. A check already on the page before
// the press is not the press's answer; only a check that appeared, or one that
// turned from self-clearing into person-only, is.
//
// **Nothing is waited for unless a check appears.** A press that puts none up
// is released when the rate-limit window closes, or sooner, when the pressed
// control leaves the document or the document starts to leave -- the same
// signals the rate-limit watch ends on, so the two end together and an
// ordinary click pays nothing more. Once a check is seen:
//
// - one only a person can answer ends the watch at once: `person_only`;
// - one that says it is checking by itself is followed for up to the wait the
//   caller allows (at most 15 s): it going away is `cleared`, it turning into
//   one only a person can answer is `person_only`, and the time running out
//   is `not_cleared`;
// - the document starting to leave while it is followed ends the watch with no
//   sighting, so the result reaches the worker before the document goes; the
//   worker then judges where the tab landed (`runtime/click-landing.ts`).
//
// Nothing here presses, types into or reloads the check. What leaves the frame
// is only what was concluded and when, never the check's words.

import { robotCheckIn, type RobotCheckKind } from "../challenge-evidence";

/** What a press's robot check came to, as far as it may be reported. */
export type RobotCheckSighting = {
  /** `person_only` and `not_cleared` are the person's to answer; `cleared` went away by itself. */
  outcome: "person_only" | "not_cleared" | "cleared";
  /** How long after the press the check was first seen. */
  afterMs: number;
  /** How long it was followed after that. */
  waitedMs: number;
};

export type RobotCheckWatch = {
  /**
   * Resolves once the press's answer is known: a sighting, or `undefined` when
   * no check appeared within `windowMs`, the press was answered otherwise, or
   * the document began to leave. A self-clearing check is followed for up to
   * `waitMs` from when it was seen. Stops the watch.
   */
  settle(windowMs: number, waitMs: number): Promise<RobotCheckSighting | undefined>;
  /** Stops without waiting; safe to call more than once. */
  stop(): void;
};

/** Where the watch reads the page. Injected by tests. */
export type RobotCheckProbe = {
  read(): RobotCheckKind | undefined;
};

/** How often the page is read while the watch is open. */
const CHECK_INTERVAL_MS = 150;

/**
 * Starts watching, from just before the press on `pressed`, for a robot check
 * the press puts up. Made between the hover and the press, like the rate-limit
 * watch, so a check already on the page is not taken for the press's answer.
 */
export function watchRobotCheck(pressed: Element, probe: RobotCheckProbe = pageProbe(pressed)): RobotCheckWatch {
  const startedAt = Date.now();
  const before = probe.read();
  let leaving = false;
  const unlisten = listenForLeaving(pressed, () => {
    leaving = true;
  });
  let stopped = false;
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    unlisten();
  };

  return {
    stop,
    settle(windowMs, waitMs) {
      /** When a self-clearing check was first seen, once one has been. */
      let seenAt: number | undefined;
      const sighting = (outcome: RobotCheckSighting["outcome"], now: number): RobotCheckSighting => ({
        outcome,
        afterMs: (seenAt ?? now) - startedAt,
        waitedMs: seenAt === undefined ? 0 : now - seenAt
      });
      /** The answer, `"open"` to keep looking, or `"none"` for no sighting. */
      const look = (now: number): RobotCheckSighting | "open" | "none" => {
        const reading = probe.read();
        const appeared = reading !== undefined && reading !== before;
        if (seenAt === undefined) {
          if (appeared && reading === "person_only") return sighting("person_only", now);
          if (appeared) {
            seenAt = now;
            return "open";
          }
          if (leaving || !pressed.isConnected || now - startedAt >= windowMs) return "none";
          return "open";
        }
        if (leaving) return "none";
        if (reading === "person_only" && before !== "person_only") return sighting("person_only", now);
        if (reading === undefined || reading === before) return sighting("cleared", now);
        if (now - seenAt >= waitMs) return sighting("not_cleared", now);
        return "open";
      };
      const answer = (found: RobotCheckSighting | "open" | "none"): RobotCheckSighting | undefined =>
        typeof found === "object" ? found : undefined;

      const immediate = look(Date.now());
      if (immediate !== "open") {
        stop();
        return Promise.resolve(answer(immediate));
      }
      return new Promise((resolve) => {
        const tick = (): void => {
          const found = look(Date.now());
          if (found === "open") return;
          clearInterval(poll);
          clearTimeout(windowEnd);
          stop();
          resolve(answer(found));
        };
        const poll = setInterval(tick, CHECK_INTERVAL_MS);
        // One look exactly as the window closes, so a press that put no check
        // up is released then, not up to an interval later.
        const windowEnd = setTimeout(tick, Math.max(0, startedAt + windowMs - Date.now()));
      });
    }
  };
}

/** The pressed element's own document, read for a robot check as a page is. */
function pageProbe(pressed: Element): RobotCheckProbe {
  return {
    read: () => {
      const body = pressed.ownerDocument?.body;
      return body ? robotCheckIn(body, "page") : undefined;
    }
  };
}

/**
 * Listens on the pressed element's window for the document starting to leave,
 * and returns how to stop listening -- the signals the rate-limit watch ends
 * on (`../rate-limit-notice.ts`).
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
