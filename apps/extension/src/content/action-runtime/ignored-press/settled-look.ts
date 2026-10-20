// Whether a press certainly did nothing: the page, once it settled, is exactly
// as it was before the press (t517).
//
// The ignored-press watch (`ignored-press-watch.ts`) settles at the first sign
// of an answer, and a change inside the control's section is one. That is
// right for deciding whether the click itself may press again, and wrong for
// a control that answers with a busy state and then reverts:
// social-network-feed's Post spins for 450 ms on its first press, turns back
// into Post, and posts nothing; only the second press posts. The spinner read
// as the page's answer, so trials and playback passed the press and posted
// nothing (`run-mv6v2jh4-69244ffb`).
//
// So, beside the watch and from the same instant just before the press, this
// look keeps:
//
// - the section's settled state before the press (`press-scope.ts`): its
//   markup, the markup of every shadow root in it (`scope-roots.ts`), and what
//   each field in it holds, which markup does not show;
// - the same listener the watch uses (`page-press-listener.ts`), kept running:
//   a request, a navigation or a focus move at any point means the press was
//   answered, and each change inside the section moves the time it was last
//   seen to move;
// - one observer on the document and its reachable open shadow roots: any change outside the section --
//   content, an attribute, a dialog opened or closed -- means the press may
//   have been answered there, so it is not certain.
//
// `settle` then waits, within its window, for the section to be quiet for
// `QUIET_MS` and compares it with how it was before the press. Only exactly the
// same state, with nothing else seen, is certain. A section quiet but different
// is given until `HELD_MS` of quiet to come back, because a busy state holds
// still while it shows -- Post's spinner is a CSS animation, 450 ms without a
// mutation -- and is then read as answered, so a press that opened something in
// its own section waits that long and no longer. Anything it cannot read --
// no document, no observer, markup it cannot serialise -- is not certain, and
// neither is a section still moving when the window ends. The cost is one
// serialisation of the section before the press and one per poll while
// settling, and the document observer while the press is watched; nothing here
// captures a snapshot, presses anything, or reports what the page wrote.
//
// **A press the page answered with nothing but its own notice (t743).** Rerun
// round 4's job trial pressed a save control; the control showed a busy state,
// reverted, and the page put a notice in a `role="status"` region saying the
// save failed. It saved nothing, but the notice was a change outside the
// section, so the press was read as answered, passed, and counted as a landed
// act (`run-mvgw1854-5d10955b`). So a change inside one of the page's own notice
// regions (`live-region.ts`: `role="alert"`, `role="status"`,
// `aria-live="assertive"`; never a bare `aria-live="polite"`), or
// one that only adds or removes such a region, is not an answer, and live
// regions are left out of the section's state. When everything else settled
// exactly as before the press and a live region now holds words it did not
// hold before it, the look answers `"announced"`: the page reported the press
// and did nothing else. The words are never read, only compared, so a success
// notice is told apart by what comes with it, not by what it says: a press the
// page carried out began a request, or left the control or the page changed,
// and any of those is an answer as before. A press whose control itself sits in
// a live region gets none of this -- every change around it would be a notice --
// and is looked at exactly as before.

import { composedContains, openRootsWithin } from "../../shadow-dom";
import { isLiveRegion } from "./live-region";
import { listenForPressAnswer, type PressListener } from "./page-press-listener";
import type { PressSignal } from "./press-again";
import { pressScope } from "./press-scope";
import { scopeRoots } from "./scope-roots";

/** Whether the press certainly did nothing, once the page settled. */
export type SettledLook = {
  /**
   * Resolves `true` only when, within `windowMs`, the section settled exactly as it was before the press and
   * nothing else moved; `"announced"` when that held apart from a live region now holding new words (header,
   * t743); `false` otherwise. Stops the look.
   */
  settle(windowMs: number): Promise<boolean | "announced">;
  /** Stops without settling; safe to call more than once. */
  stop(): void;
};

/** What the look observes the whole document with. The content script's own by default; injected by tests. */
export type SettledLookPage = { MutationObserver?: typeof MutationObserver | undefined };

/** How long the section must stay unchanged before its state is compared with the one before the press. */
const QUIET_MS = 250;

/** How long a section quiet and different from before the press is given to come back before it is read as answered. */
const HELD_MS = 700;

/** How often the look reads the page while settling. */
const CHECK_INTERVAL_MS = 50;

const OBSERVED: MutationObserverInit = { childList: true, subtree: true, attributes: true, characterData: true };

/** The fields whose held value markup does not show. */
const FIELDS = "input, textarea, select";

/** Every element that could be a live region; `isLiveRegion` decides. */
const LIVE_CANDIDATES = "[role], [aria-live]";

/** A look that can never be certain: the page could not be read. */
const UNCERTAIN: SettledLook = { settle: () => Promise.resolve(false), stop: () => undefined };

/** Starts looking, from just before the press on `pressed`, for whether the page settles exactly as it was. */
export function lookUntilSettled(
  pressed: Element,
  probe: (pressed: Element, note: (signal: PressSignal) => void) => PressListener = listenForPressAnswer,
  page: SettledLookPage = { MutationObserver: globalThis.MutationObserver }
): SettledLook {
  const root = pressed.ownerDocument?.documentElement;
  const Observer = page.MutationObserver;
  if (!root || typeof Observer !== "function") return UNCERTAIN;
  const scope = pressScope(pressed);
  const roots = scopeRoots(pressed, scope);
  // A control inside a live region: every change around it would read as a notice (header, t743).
  const notices = !withinLiveRegion(pressed);
  const before = sectionState(scope, roots, notices);
  if (before === undefined) return UNCERTAIN;

  let answered = false;
  let lastChangeAt = Date.now();
  const listener = probe(pressed, (signal) => {
    if (signal === "change") lastChangeAt = Date.now();
    else answered = true;
  });
  const noteElsewhere = (records: readonly MutationRecord[]): void => {
    if (records.some((record) => !composedContains(scope, record.target) && !(notices && announces(record)))) answered = true;
  };
  const elsewhere = new Observer((records) => noteElsewhere(records));
  elsewhere.observe(root, OBSERVED);
  // A document observer cannot see answers rendered inside another component's
  // shadow root. Observe all reachable roots too, including nested ones.
  const pageRoots = typeof root.querySelectorAll === "function" ? openRootsWithin(root) : [];
  for (const shadow of pageRoots) elsewhere.observe(shadow, OBSERVED);
  /** What each live region said just before the press, to tell a new notice from one already standing. */
  const saidBefore = notices ? liveWords([root, ...pageRoots]) : new Map<Element, string>();

  let stopped = false;
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    listener.stop();
    elsewhere.disconnect();
  };
  const read = (): void => {
    listener.flush();
    noteElsewhere(elsewhere.takeRecords());
    // attachShadow on an existing host need not mutate the document. A root
    // that appeared after observation started invalidates certainty, since its
    // initial answer could have been rendered before any observer was attached.
    if (typeof root.querySelectorAll === "function" && openRootsWithin(root).some((shadow) => !pageRoots.includes(shadow))) answered = true;
  };
  /** A live region now holds words it did not hold before the press (header, t743). */
  const announced = (): boolean => {
    if (!notices) return false;
    for (const [region, words] of liveWords([root, ...pageRoots])) {
      if (words.length > 0 && saidBefore.get(region) !== words) return true;
    }
    return false;
  };

  return {
    stop,
    settle(windowMs) {
      if (stopped || windowMs <= 0) {
        stop();
        return Promise.resolve(false);
      }
      const deadline = Date.now() + windowMs;
      return new Promise((resolve) => {
        const check = (): void => {
          read();
          const now = Date.now();
          const quietMs = now - lastChangeAt;
          const same = quietMs >= QUIET_MS && sectionState(scope, roots, notices) === before;
          const verdict = stopped || answered ? false : same ? (announced() ? "announced" : true) : quietMs >= HELD_MS || now >= deadline ? false : undefined;
          if (verdict === undefined) return;
          clearInterval(poll);
          stop();
          resolve(verdict);
        };
        const poll = setInterval(check, CHECK_INTERVAL_MS);
        check();
      });
    }
  };
}

/**
 * The section as it settles: its markup, each shadow root's, and every field's
 * held value and checked state, joined. Never leaves this module; it is only
 * compared. With `notices`, each live region in it is left out (header, t743).
 * Undefined when the section cannot be serialised.
 */
function sectionState(scope: Element, roots: readonly Node[], notices: boolean): string | undefined {
  const markup = (scope as { outerHTML?: unknown }).outerHTML;
  if (typeof markup !== "string") return undefined;
  const parts = [notices ? withoutLiveRegions(markup, scope) : markup];
  for (const root of roots) {
    const inner = (root as { innerHTML?: unknown }).innerHTML;
    const text = typeof inner === "string" ? inner : "";
    parts.push(notices ? withoutLiveRegions(text, root) : text);
  }
  for (const holder of [scope, ...roots] as Array<Element | ParentNode>) {
    if (typeof holder.querySelectorAll !== "function") continue;
    for (const field of Array.from(holder.querySelectorAll(FIELDS))) parts.push(fieldState(field));
  }
  return parts.join("\u0000");
}

function fieldState(field: Element): string {
  const held = field as Element & { value?: unknown; checked?: unknown; selectedIndex?: unknown };
  return `${String(held.value ?? "")}\u0001${String(held.checked ?? "")}\u0001${String(held.selectedIndex ?? "")}`;
}

/** `markup` with the markup of every live region inside `holder` taken out; an outer region first, so one inside it goes with it. */
function withoutLiveRegions(markup: string, holder: Element | Node): string {
  let left = markup;
  for (const region of liveRegionsIn(holder)) {
    const own = (region as { outerHTML?: unknown }).outerHTML;
    if (typeof own === "string" && own.length > 0) left = left.split(own).join("");
  }
  return left;
}

/** The live regions inside `holder`, in document order; none where it cannot be searched. */
function liveRegionsIn(holder: Element | Node): Element[] {
  const searchable = holder as { querySelectorAll?: (selector: string) => ArrayLike<Element> };
  if (typeof searchable.querySelectorAll !== "function") return [];
  return Array.from(searchable.querySelectorAll(LIVE_CANDIDATES)).filter(isLiveRegion);
}

/** The words each live region under `holders` holds now, trimmed. Compared only, never sent. */
function liveWords(holders: ReadonlyArray<Element | Node>): Map<Element, string> {
  const said = new Map<Element, string>();
  for (const holder of holders) {
    for (const region of liveRegionsIn(holder)) said.set(region, String((region as { textContent?: unknown }).textContent ?? "").replace(/\s+/gu, " ").trim());
  }
  return said;
}

/** Whether `node` is, or sits inside, a live region, across shadow boundaries. */
function withinLiveRegion(node: Node | null | undefined): boolean {
  for (let current: Node | null | undefined = node; current; ) {
    if (isLiveRegion(current)) return true;
    const shadowHost = current.nodeType === 11 ? (current as ShadowRoot).host : undefined;
    current = shadowHost ?? current.parentNode;
  }
  return false;
}

/** A change that is only the page announcing: inside a live region, or adding or removing nothing but live regions (header, t743). */
function announces(record: MutationRecord): boolean {
  if (withinLiveRegion(record.target)) return true;
  if (record.type !== "childList") return false;
  const moved = [...Array.from(record.addedNodes ?? []), ...Array.from(record.removedNodes ?? [])];
  return moved.length > 0 && moved.every(isLiveRegion);
}
