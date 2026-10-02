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
//
// **A page that was too busy to carry the press out says so beside the control,
// not over the page.** crossborder's store coupon -- a widget in its own shadow
// root -- turns its button to "…", waits, asks the server, and on the first
// claim of every visit puts "Network busy, please try again" under the button
// and collects nothing. Until 2026-10-01 that press was a success, and a Flow
// that claimed the coupon once read it as collected (lane A, `t174-w32`). So the
// watch also reads the pressed control's own region -- its composed ancestors,
// `REGION_LEVELS` up, shadow roots included -- for a busy refusal
// (`vocabulary.ts`, a closed phrase list) that was not there at the press, or
// that went away after the press and came back. That is reported as a refusal
// that named no wait (`busy`), so Core's backoff decides when the press is made
// again. Such an answer comes after the server does, later than the window:
// so while the pressed control shows it is still working -- its label has lost
// every word it had (the coupon's "…", a spinner in place of "Add to cart"), or
// it says `aria-busy` -- the watch keeps reading past the window, for at most
// `BUSY_LIMIT_MS` from the press, and reads once more when it stops working.
//
// **A page that will not carry the press out until it is given something first
// says so in a line it writes into the same region.** crossborder's Add to cart,
// pressed with no colour chosen, writes "Please select a Color." under the
// options and adds nothing. Until 2026-10-02 the click passed on its hit test,
// was pressed once more as ignored, and reported success with nothing in the
// cart, in exploration, the dry run and playback alike (`run-muqk4u32-0b36e58f`,
// t174 F40). So the watch also reads each short line the press wrote into the
// region (`written-lines/`) against a closed phrase list
// (`interference/vocabulary.ts`, "please select", "is required", "purchase
// limit"), and such a line is reported as a refusal that needs something first
// (`needs`). It settles at once: there is no wait to read and nothing to be
// gained by pressing again until the page has what it asked for. Its line comes
// after the server for a limit the server decides, so it too is read past the
// window while the control is still working.

import { composedParent } from "../shadow-dom";
import { boundedLayerText, isPageRequirementText, isRateLimitLayerText, isTransientRefusalText, overlaysOverPage } from "./interference";
import { watchWrittenLines, type WrittenLines } from "./written-lines";

/** A press the page refused -- for going too fast, because it was busy, or because it needs something first -- as far as it may be reported. */
export type RateLimitNotice = {
  /** How long after the press the notice was seen. */
  afterMs: number;
  /** The wait the notice named, plus a margin, in milliseconds; absent when it named none. */
  retryAfterMs?: number;
  /** The page said it was busy and could not carry the press out, rather than that the press went too fast. */
  busy?: true;
  /** The page wrote beside the control that it needs something first -- a choice, a value -- and did not carry the press out. */
  needs?: true;
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

/**
 * Where the watch reads the page: the layers painted over it, and a layer's own
 * words; and, when given, the words of the pressed control's own region and of
 * the control itself. Injected by tests.
 */
export type RateLimitProbe = {
  layers(): readonly Element[];
  textOf(layer: Element): string;
  /** The bounded words of each region around the pressed control, nearest first. */
  regionTexts?(pressed: Element): readonly string[];
  /** The pressed control's own bounded words. */
  labelOf?(pressed: Element): string;
  /** The short lines the press writes into the pressed control's region, from the moment this is called (`written-lines/`). */
  writtenLines?(pressed: Element): WrittenLines;
};

/** How often the page is looked at while the window is open. */
const CHECK_INTERVAL_MS = 100;

/** Added to the named wait so the retry lands after the page's window, not on its edge. */
const RETRY_MARGIN_MS = 500;

/** The longest wait reported: a notice asking for longer is asking for more than a run gives one step. */
const RETRY_AFTER_MAX_MS = 60_000;

/** "try again in 12 seconds", "retry in 2 minutes", "wait 30 s": the number and its unit. */
const NAMED_WAIT = /\b(?:try again|retry|wait)(?: again)? (?:in |for )?(\d{1,6}) ?(s|secs?|seconds?|mins?|minutes?)\b/iu;

/** How many composed ancestors of the pressed control are its region: the widget and the row or card it sits in. */
const REGION_LEVELS = 3;

/** The longest a press is followed past its window while its control shows it is still working, counted from the press. */
const BUSY_LIMIT_MS = 3_000;

/** A letter or a digit: a label with none is one that has turned into "…" or a spinner. */
const WORD = /[\p{L}\p{N}]/u;

/** The page-wide elements a region never widens to. */
const PAGE_TAGS = new Set(["body", "html"]);

/** The bounded words of the pressed control's composed ancestors, nearest first, never the body or the document. */
function pressedRegionTexts(pressed: Element): string[] {
  const texts: string[] = [];
  let current = composedParent(pressed);
  for (let level = 0; current && level < REGION_LEVELS; level += 1) {
    if (PAGE_TAGS.has(String(current.tagName ?? "").toLowerCase())) break;
    texts.push(boundedLayerText(current));
    current = composedParent(current);
  }
  return texts;
}

const PAGE_PROBE: RateLimitProbe = {
  layers: overlaysOverPage,
  textOf: boundedLayerText,
  regionTexts: pressedRegionTexts,
  labelOf: boundedLayerText,
  writtenLines: (pressed) => watchWrittenLines(pressed, REGION_LEVELS)
};

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
  const written = probe.writtenLines?.(pressed);
  let stopped = false;
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    unlisten();
    written?.stop();
  };

  /** Whether the pressed control's region says the page was busy. */
  const regionRefuses = (): boolean => (probe.regionTexts?.(pressed) ?? []).some(isTransientRefusalText);
  const refusedBefore = regionRefuses();
  /** Whether the region has read free of a busy refusal since the press: a page that clears its old line on the press and writes it again refused again. */
  let clearedSincePress = !refusedBefore;
  const labelBefore = probe.labelOf?.(pressed) ?? "";

  /** Whether the pressed control shows it is still working on the press: `aria-busy`, or a label that has lost every word it had. */
  const stillWorking = (): boolean => {
    if (probe.labelOf === undefined || !pressed.isConnected) return false;
    if (pressed.getAttribute?.("aria-busy") === "true") return true;
    return WORD.test(labelBefore) && !WORD.test(probe.labelOf(pressed));
  };

  /** A busy refusal the press brought into the pressed control's region. */
  const busyRefusal = (): boolean => {
    if (!regionRefuses()) {
      clearedSincePress = true;
      return false;
    }
    return clearedSincePress;
  };

  /** The notice, `"answered"` when the press was plainly answered otherwise, or `undefined` to keep looking. */
  const check = (): RateLimitNotice | "answered" | undefined => {
    for (const layer of probe.layers()) {
      if (before.has(layer)) continue;
      const text = probe.textOf(layer);
      if (isTransientRefusalText(text) && !isRateLimitLayerText(text)) return { afterMs: Date.now() - startedAt, busy: true };
      if (!isRateLimitLayerText(text)) continue;
      const retryAfterMs = namedWaitMs(text);
      return { afterMs: Date.now() - startedAt, ...(retryAfterMs === undefined ? {} : { retryAfterMs }) };
    }
    if (leaving) return "answered";
    // Read before the control is asked after: a page that redraws its form
    // with the line in it replaces the control too.
    if ((written?.take() ?? []).some(isPageRequirementText)) return { afterMs: Date.now() - startedAt, needs: true };
    if (!pressed.isConnected) return "answered";
    return busyRefusal() ? { afterMs: Date.now() - startedAt, busy: true } : undefined;
  };

  /**
   * A notice seen before its wait could be read. It is the answer if the window
   * closes first; until then the watch keeps looking, because a countdown the
   * page fills in a moment later is the wait Core needs, and without it Core
   * retries at once into the same refusal (`run-munq51ik-a7ebd077`).
   */
  let waitless: RateLimitNotice | undefined;
  /** Whether this sighting ends the watch now: anything but a notice still missing its wait. A page that needs something first names none to miss. */
  const settles = (found: RateLimitNotice | "answered" | undefined): boolean => {
    if (found === undefined) return false;
    if (found !== "answered" && found.needs === undefined && found.retryAfterMs === undefined) {
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
        /** Set once the window has closed on a control still working on the press. */
        let overtime = false;
        const look = (): void => {
          const found = check();
          if (settles(found)) return finish(found);
          // Past the window, the watch ends when the control stops working --
          // with one more look, since its answer and the end of its work are
          // usually painted together -- or at the busy limit.
          if (overtime && (!stillWorking() || Date.now() - startedAt >= BUSY_LIMIT_MS)) finish(check());
        };
        wake = look;
        const poll = setInterval(look, CHECK_INTERVAL_MS);
        // One last look at the deadline, so a notice painted inside the final
        // interval is not reported as none; unless the control is still working
        // on the press, when the watch reads on (see the file comment).
        const deadline = setTimeout(() => {
          if (stillWorking() && Date.now() - startedAt < BUSY_LIMIT_MS) {
            overtime = true;
            return;
          }
          finish(check());
        }, windowMs);
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
