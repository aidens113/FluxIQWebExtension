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

import { composedContains, openRootsWithin } from "../../shadow-dom";
import { listenForPressAnswer, type PressListener } from "./page-press-listener";
import type { PressSignal } from "./press-again";
import { pressScope } from "./press-scope";
import { scopeRoots } from "./scope-roots";

/** Whether the press certainly did nothing, once the page settled. */
export type SettledLook = {
  /** Resolves `true` only when, within `windowMs`, the section settled exactly as it was before the press and nothing else moved. Stops the look. */
  settle(windowMs: number): Promise<boolean>;
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
  const before = sectionState(scope, roots);
  if (before === undefined) return UNCERTAIN;

  let answered = false;
  let lastChangeAt = Date.now();
  const listener = probe(pressed, (signal) => {
    if (signal === "change") lastChangeAt = Date.now();
    else answered = true;
  });
  const noteElsewhere = (records: readonly MutationRecord[]): void => {
    if (records.some((record) => !composedContains(scope, record.target))) answered = true;
  };
  const elsewhere = new Observer((records) => noteElsewhere(records));
  elsewhere.observe(root, OBSERVED);
  // A document observer cannot see answers rendered inside another component's
  // shadow root. Observe all reachable roots too, including nested ones.
  const pageRoots = typeof root.querySelectorAll === "function" ? openRootsWithin(root) : [];
  for (const shadow of pageRoots) elsewhere.observe(shadow, OBSERVED);

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
          const same = quietMs >= QUIET_MS && sectionState(scope, roots) === before;
          const verdict = stopped || answered ? false : same ? true : quietMs >= HELD_MS || now >= deadline ? false : undefined;
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
 * compared. Undefined when the section cannot be serialised.
 */
function sectionState(scope: Element, roots: readonly Node[]): string | undefined {
  const markup = (scope as { outerHTML?: unknown }).outerHTML;
  if (typeof markup !== "string") return undefined;
  const parts = [markup];
  for (const root of roots) {
    const inner = (root as { innerHTML?: unknown }).innerHTML;
    parts.push(typeof inner === "string" ? inner : "");
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
