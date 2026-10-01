// What a link click did to its own page when the page's script took the click
// over instead of letting the browser navigate.
//
// A link states where it goes, and much of the web no longer goes there: a
// filter, a sector list, a pager, a tab strip or a router link cancels the
// navigation and fetches or reveals the new content in place, sometimes moving
// the address with `history.pushState` and often not at all. Such a click
// worked if the page visibly answered it. This watches the click's own document
// for the two answers a reader could see:
//
// - **The address moved.** Read by polling `location.href`, because a history
//   API move mutates nothing; a router that pushes only after its fetch lands
//   is caught as well as one that pushes at once.
// - **The content changed.** The page's rendered text (`body.innerText` and
//   the rendered text of every open shadow root, `composed-rendered-text.ts`:
//   what a reader sees, so text in a hidden panel is not in it) differs from
//   what it was when the press began, *and* since the press the page's
//   structure moved somewhere other than the link: an element added or
//   removed, an attribute changed on an element outside the link, or the link's
//   own attributes left different from how they started.
//
// Both halves of the content rule are there to keep a click that did nothing
// from passing. The text comparison rules out a busy flag or a ripple that
// shows nothing new. The structural half rules out text that changes on its
// own: a clock, a counter or a "3 minutes ago" rewrites its text without moving
// any structure, so a page whose only motion is that never opens the gate. The
// inside of the link is left out because a pressed link grows a ripple or
// toggles a class whether or not the click then does anything; only a lasting
// change to the link itself -- it now reads as the active filter, say -- counts.
//
// The baseline is taken when the watch is made, which the click verb does after
// the hover events and just before the press, so what hovering alone does is
// not counted as the click's effect.
//
// **Open shadow roots are part of the page.** A web component that opens its
// panel inside its own root (bigbox's store picker, `run-mum0ke7z-940cbd27`)
// mutates nothing in the document tree, and an observer's `subtree` stops at
// every shadow boundary. So each open root beneath the document is observed as
// well: those there when the watch starts, those carried in by an element added
// since, and -- walked for again at the first check, every `ROOT_RESCAN_MS` and
// at the deadline -- those attached to an element already in place, which
// `attachShadow` and a late custom-element upgrade do without any mutation to
// observe. A root that appeared since the press, outside the link, is structure
// that moved. "Inside the link" crosses shadow boundaries too, so a ripple drawn
// inside the link's own component still counts for nothing.
//
// Not caught, in the direction that matters: a page that is already changing
// on its own in both ways -- a live feed, a ticking clock beside a
// script-driven animation, or components upgrading late and drawing text -- can
// make a dead link read as answered, since this has no view of the page before
// the click. In the other direction, an effect with no text (a lightbox of one
// image), one inside a closed shadow root, and one in another tab or window
// are not seen, and such a click still fails as it did.

import { composedContains, composedRoots, openRootsWithin } from "../shadow-dom";
import { composedRenderedText } from "./composed-rendered-text";

/** How often the address is read, and the most often the rendered text is. */
const CHECK_INTERVAL_MS = 100;

/** How often the page is walked again for open shadow roots attached without a mutation. */
const ROOT_RESCAN_MS = 500;

const ELEMENT_NODE = 1;

/** What is observed in the document and in every open root. */
const OBSERVED: MutationObserverInit = { childList: true, subtree: true, attributes: true, characterData: true };

/** The answer a script-handled link click was seen to give, and how long after the press. */
export type InPlaceEffect =
  | { kind: "address"; url: string; afterMs: number }
  | { kind: "content"; afterMs: number };

export type InPlaceEffectWatch = {
  /**
   * Resolves with the first effect seen within `timeoutMs`, or `undefined`
   * when the page gave none. Checks once at once, so an effect the click's own
   * handler made synchronously is answered without waiting. Stops the watch.
   */
  settle(timeoutMs: number): Promise<InPlaceEffect | undefined>;
  /** Disconnects without waiting; safe to call more than once. */
  stop(): void;
};

/** Starts watching `link`'s document, open shadow roots included, for an in-place answer to a click on it. */
export function watchInPlaceEffect(link: Element): InPlaceEffectWatch {
  const document = link.ownerDocument;
  const startedAt = Date.now();
  const address = document.location?.href;
  /** Every open shadow root observed; the rendered text is read across all of them. */
  const roots = new Set<ShadowRoot>(openRoots(document));
  const text = composedRenderedText(document, roots);
  const linkAttributes = attributeSignature(link);
  /** Sticky: the page's structure moved outside the link at some point since the press. */
  let structureMoved = false;
  /** The link's own attributes changed and have not been compared since. */
  let linkTouched = false;
  /** Anything changed since the rendered text was last read. */
  let dirty = false;
  /** When the page was last walked for open roots; `undefined` until the first check. */
  let lastRescan: number | undefined;

  const observer = new MutationObserver((records) => note(records));
  /** Observes a root found since the press. One outside the link is structure that moved. */
  const adopt = (root: ShadowRoot): void => {
    if (roots.has(root)) return;
    roots.add(root);
    observer.observe(root, OBSERVED);
    dirty = true;
    if (!composedContains(link, root.host)) structureMoved = true;
  };
  const note = (records: readonly MutationRecord[]): void => {
    for (const record of records) {
      dirty = true;
      const where = structuralChange(record, link);
      if (where === "page") structureMoved = true;
      else if (where === "link") linkTouched = true;
      if (record.type !== "childList") continue;
      // An element added since the press may carry open roots of its own: a
      // component inserted already upgraded, or a subtree holding several.
      for (const node of record.addedNodes) {
        if (node.nodeType === ELEMENT_NODE) openRootsWithin(node as Element).forEach(adopt);
      }
    }
  };
  if (document.documentElement) observer.observe(document.documentElement, OBSERVED);
  for (const root of roots) observer.observe(root, OBSERVED);
  let stopped = false;
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    observer.disconnect();
  };

  const check = (final: boolean): InPlaceEffect | undefined => {
    const afterMs = Date.now() - startedAt;
    const now = document.location?.href;
    if (address !== undefined && now !== undefined && now !== address) return { kind: "address", url: now, afterMs };
    // Records the observer has not delivered yet: the handler's own synchronous
    // changes are still queued when `settle` makes its first check.
    note(observer.takeRecords());
    // A root attached to an element already in place leaves no record, so the
    // page is walked for one now and then.
    const at = Date.now();
    if (final || lastRescan === undefined || at - lastRescan >= ROOT_RESCAN_MS) {
      lastRescan = at;
      openRoots(document).forEach(adopt);
    }
    if (linkTouched) {
      linkTouched = false;
      if (attributeSignature(link) !== linkAttributes) structureMoved = true;
    }
    // Read only once the structure has moved and something changed since the
    // last read, so a quiet page, or one only a clock moves, costs no layout.
    if (!structureMoved || !dirty) return undefined;
    dirty = false;
    return composedRenderedText(document, roots) !== text ? { kind: "content", afterMs } : undefined;
  };

  return {
    stop,
    settle(timeoutMs) {
      const immediate = check(timeoutMs <= 0);
      if (immediate !== undefined || timeoutMs <= 0) {
        stop();
        return Promise.resolve(immediate);
      }
      return new Promise((resolve) => {
        const finish = (effect: InPlaceEffect | undefined): void => {
          clearInterval(poll);
          clearTimeout(deadline);
          stop();
          resolve(effect);
        };
        const poll = setInterval(() => {
          const effect = check(false);
          if (effect !== undefined) finish(effect);
        }, CHECK_INTERVAL_MS);
        // One last look at the deadline, so an effect landing inside the final
        // interval is not reported as none.
        const deadline = setTimeout(() => finish(check(true)), timeoutMs);
      });
    }
  };
}

/** The open shadow roots beneath the document, nested ones included. */
function openRoots(document: Document): ShadowRoot[] {
  return composedRoots(document).filter((root): root is ShadowRoot => root !== document);
}

/**
 * Where a mutation moved the page's structure: `page` for an element added or
 * removed, or an attribute changed, outside the link; `link` for an attribute
 * of the link itself, which counts only if it lasts; nothing for a change
 * inside the link -- its own shadow tree included -- or for text rewriting
 * itself, which is how a clock or a counter moves.
 */
function structuralChange(record: MutationRecord, link: Element): "page" | "link" | undefined {
  if (record.type === "attributes") {
    if (record.target === link) return "link";
    return composedContains(link, record.target) ? undefined : "page";
  }
  if (record.type !== "childList" || composedContains(link, record.target)) return undefined;
  const elementMoved = [...record.addedNodes, ...record.removedNodes].some((node) => node.nodeType === ELEMENT_NODE);
  return elementMoved ? "page" : undefined;
}

/**
 * The link's own attributes, in a form two readings can be compared by. A
 * class list is compared as a set of tokens, and an empty class or style is
 * no attribute at all: a press that adds `is-pressed` and takes it away again
 * leaves `class=""` on a link that had none, which shows nothing new.
 */
function attributeSignature(element: Element): string {
  const entries: string[] = [];
  for (const { name, value } of [...element.attributes]) {
    if (name === "class") {
      const tokens = [...new Set(value.split(/\s+/u).filter(Boolean))].sort();
      if (tokens.length > 0) entries.push(`class=${tokens.join(" ")}`);
    } else if (name !== "style" || value.trim()) {
      entries.push(`${name}=${value}`);
    }
  }
  return entries.sort().join("\n");
}
