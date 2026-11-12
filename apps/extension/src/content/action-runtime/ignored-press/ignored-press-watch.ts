// Whether the page answered a press at all.
//
// Made just before a press that is not a link (`actions/click.ts`, in the
// gesture's `beforePress`, beside the rate-limit and robot-check watches), it
// reads the signs `page-press-listener.ts` listens for and settles as soon as
// any one is seen -- a press the page answered costs no wait -- or when the
// window closes with none. Only a press that settles with nothing seen is a
// candidate for pressing once more, which `press-again.ts` decides.
// A command with no fresh binding and known pending page work keeps this same watch
// open past that window until it binds, work drains, or its command expires.
// A late request or effect still ends the watch and forbids a duplicate press.
//
// Beside it, from the same instant, a settled look (`settled-look.ts`, t517)
// keeps watching after that first sign: a press answered only by a change in
// its section that came and went -- a spinner that turns back into the button
// -- is asked, through `settleUnchanged`, whether the page settled exactly as it
// was. The watch only carries it; the click decides what to do with it.

import { listenForPressAnswer, type PressListener } from "./page-press-listener";
import type { PressSignal } from "./press-again";
import { lookUntilSettled, type SettledLook } from "./settled-look";

/** What the page was seen to do after the press, and how long the watch ran. */
export type IgnoredPressAnswer = {
  /** Every distinct sign seen, in the order first seen; empty when the page did nothing. */
  seen: PressSignal[];
  /** How long after the press the watch settled. */
  afterMs: number;
  /** Known page work outlasted the command's own deadline; no extra press is available after it. */
  readinessTimedOut?: true;
};

export type IgnoredPressWatch = {
  /**
   * Resolves as soon as any sign of an answer is seen, or with none when
   * `windowMs` passes first. Checks once at once, so what the press's own
   * handler did synchronously answers without waiting. Positive readiness
   * evidence keeps the original watch open within the command's own remaining
   * time; it never authorizes a second press. Stops the watch.
   */
  settle(windowMs: number, readiness?: { pending(): boolean; remainingMs(): number }): Promise<IgnoredPressAnswer>;
  /**
   * After `settle`: resolves `true` only when, within `windowMs`, the page
   * settled exactly as it was before the press and nothing else answered it,
   * `"announced"` when that held but for a notice the page put in one of its
   * own notice regions (t743), and `false` otherwise (`settled-look.ts`).
   * Stops the look.
   */
  settleUnchanged(windowMs: number, work?: { workDone(): boolean }): Promise<boolean | "announced">;
  /** Stops without waiting, the settled look included; safe to call more than once. */
  stop(): void;
};

/** Where the watch reads the page. Injected by tests. */
export type IgnoredPressProbe = (pressed: Element, note: (signal: PressSignal) => void) => PressListener;

/** How often queued signs are flushed while the window is open. */
const CHECK_INTERVAL_MS = 50;

/** Starts watching, from just before the press on `pressed`, for any answer to it. */
export function watchIgnoredPress(
  pressed: Element,
  probe: IgnoredPressProbe = listenForPressAnswer,
  look: (pressed: Element) => SettledLook = (element) => lookUntilSettled(element, probe)
): IgnoredPressWatch {
  const startedAt = Date.now();
  const settledLook = look(pressed);
  const seen: PressSignal[] = [];
  let wake: (() => void) | undefined;
  const listener = probe(pressed, (signal) => {
    if (seen.includes(signal)) return;
    seen.push(signal);
    wake?.();
  });
  let stopped = false;
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    wake = undefined;
    listener.stop();
  };
  const answer = (): IgnoredPressAnswer => ({ seen: [...seen], afterMs: Date.now() - startedAt });

  return {
    stop() {
      stop();
      settledLook.stop();
    },
    settleUnchanged: (windowMs, work) => settledLook.settle(windowMs, work),
    settle(windowMs, readiness) {
      if (!stopped) listener.flush();
      if (seen.length > 0 || windowMs <= 0 && !readiness?.pending() || stopped) {
        stop();
        return Promise.resolve(answer());
      }
      return new Promise((resolve) => {
        let poll: ReturnType<typeof setInterval> | undefined;
        let deadline: ReturnType<typeof setTimeout> | undefined;
        let budgetDeadline: ReturnType<typeof setTimeout> | undefined;
        let windowClosed = false;
        let finished = false;
        const finish = (timedOut = false): void => {
          if (finished) return;
          finished = true;
          clearInterval(poll);
          clearTimeout(deadline);
          clearTimeout(budgetDeadline);
          stop();
          resolve({ ...answer(), ...(timedOut ? { readinessTimedOut: true as const } : {}) });
        };
        wake = () => finish();
        const look = (): void => {
          listener.flush();
          if (finished) return;
          if (seen.length > 0 || stopped) { finish();
            return; }
          if (!windowClosed) return;
          if (readiness && readiness.remainingMs() <= 0) finish(true);
          else if (!readiness?.pending()) finish();
        };
        poll = setInterval(look, CHECK_INTERVAL_MS);
        // Keep the ordinary deadline scheduled independently of polling. A late
        // poll must not overtake an answer already queued before that deadline.
        deadline = setTimeout(() => { windowClosed = true;
          look(); }, Math.max(0, windowMs));
        if (readiness) budgetDeadline = setTimeout(() => {
          listener.flush();
          if (!finished) finish(seen.length === 0);
        }, Math.max(0, readiness.remainingMs()));
      });
    }
  };
}
