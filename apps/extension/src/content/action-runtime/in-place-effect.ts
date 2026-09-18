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
// - **The content changed.** The page's rendered text (`body.innerText`, which
//   is what a reader sees: text in a hidden panel is not in it) differs from
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
// Not caught, in the direction that matters: a page that is already changing
// on its own in both ways -- a live feed, or a ticking clock beside a
// script-driven animation -- can make a dead link read as answered, since this
// has no view of the page before the click. In the other direction, an effect
// with no text (a lightbox of one image), one inside a shadow root, and one in
// another tab or window are not seen, and such a click still fails as it did.

/** How often the address is read, and the most often the rendered text is. */
const CHECK_INTERVAL_MS = 100;

const ELEMENT_NODE = 1;

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

/** Starts watching `link`'s document for an in-place answer to a click on it. */
export function watchInPlaceEffect(link: Element): InPlaceEffectWatch {
  const document = link.ownerDocument;
  const startedAt = Date.now();
  const address = document.location?.href;
  const text = renderedText(document);
  const linkAttributes = attributeSignature(link);
  /** Sticky: the page's structure moved outside the link at some point since the press. */
  let structureMoved = false;
  /** The link's own attributes changed and have not been compared since. */
  let linkTouched = false;
  /** Anything changed since the rendered text was last read. */
  let dirty = false;

  const note = (records: readonly MutationRecord[]): void => {
    for (const record of records) {
      dirty = true;
      const where = structuralChange(record, link);
      if (where === "page") structureMoved = true;
      else if (where === "link") linkTouched = true;
    }
  };
  const observer = new MutationObserver(note);
  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
  }
  let stopped = false;
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    observer.disconnect();
  };

  const check = (): InPlaceEffect | undefined => {
    const afterMs = Date.now() - startedAt;
    const now = document.location?.href;
    if (address !== undefined && now !== undefined && now !== address) return { kind: "address", url: now, afterMs };
    // Records the observer has not delivered yet: the handler's own synchronous
    // changes are still queued when `settle` makes its first check.
    note(observer.takeRecords());
    if (linkTouched) {
      linkTouched = false;
      if (attributeSignature(link) !== linkAttributes) structureMoved = true;
    }
    // Read only once the structure has moved and something changed since the
    // last read, so a quiet page, or one only a clock moves, costs no layout.
    if (!structureMoved || !dirty) return undefined;
    dirty = false;
    return renderedText(document) !== text ? { kind: "content", afterMs } : undefined;
  };

  return {
    stop,
    settle(timeoutMs) {
      const immediate = check();
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
          const effect = check();
          if (effect !== undefined) finish(effect);
        }, CHECK_INTERVAL_MS);
        // One last look at the deadline, so an effect landing inside the final
        // interval is not reported as none.
        const deadline = setTimeout(() => finish(check()), timeoutMs);
      });
    }
  };
}

/**
 * Where a mutation moved the page's structure: `page` for an element added or
 * removed, or an attribute changed, outside the link; `link` for an attribute
 * of the link itself, which counts only if it lasts; nothing for a change
 * inside the link or for text rewriting itself, which is how a clock or a
 * counter moves.
 */
function structuralChange(record: MutationRecord, link: Element): "page" | "link" | undefined {
  if (record.type === "attributes") {
    if (record.target === link) return "link";
    return link.contains(record.target) ? undefined : "page";
  }
  if (record.type !== "childList" || link.contains(record.target)) return undefined;
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

/** What a reader of the page sees as text; an empty string where the document has no body. */
function renderedText(document: Document): string {
  const body = document.body as (HTMLElement & { innerText?: string }) | null;
  return typeof body?.innerText === "string" ? body.innerText : "";
}
