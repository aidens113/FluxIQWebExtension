// The short lines a page writes in the pressed control's own region after a
// press: the page's own account of what it made of the press, when it gives one
// in words rather than in what it does.
//
// crossborder's Add to cart, pressed with no colour chosen, writes "Please
// select a Color." into the item's error line and adds nothing
// (`run-muqk4u32-0b36e58f`, t174 F40). That line is not beside the button in
// the tree -- the button sits in a fixed buy bar, the line under the options --
// and nothing else about the press moves: no request, nothing inside the bar.
// So `../rate-limit-notice.ts` asks this watch what was written into the
// control's region since the press, and reads each line against a closed phrase
// list (`../interference/vocabulary.ts`). The words are read, classified and
// dropped there; none of them leaves the frame.
//
// **The region** is the pressed control's composed ancestors, `levels` up,
// never the body or the document: the same region the busy refusal is read in.
// It is observed whole, and so is every shadow root the walk up crossed and
// every open root beneath it (`../ignored-press/scope-roots.ts`), since a
// mutation inside a root reaches only an observer of that root.
//
// **A line is an element the press changed** -- text written into it, a child
// added, or its `hidden`, `class`, `style` or `aria-hidden` changed, which is
// how a page shows a line it had ready -- that is rendered, holds at most
// `LINE_MAX` characters, and is not, and holds no, control of its own. That last
// rule is what keeps a press that opened something from reading as refused: a
// size chooser headed "Please select a size" holds the sizes, which are
// controls. A line that was on the page before and was not touched is not the
// press's answer and is never read; one the page cleared and wrote again, as
// crossborder's does on every press, is.

import { composedParent } from "../../shadow-dom";
import { scopeRoots } from "../ignored-press";
import { boundedLayerText } from "../interference";

/** What the press has written into the region since the last look. */
export type WrittenLines = {
  /** The text of each line changed since the last call, at most `LINE_MAX` characters each. Never leaves the frame. */
  take(): readonly string[];
  /** Stops watching; safe to call more than once. */
  stop(): void;
};

/** The part of a `MutationObserver` this watch uses. Injected by tests, which run where there is no DOM. */
export type LineObserver = {
  observe(target: Node, options: MutationObserverInit): void;
  takeRecords(): readonly MutationRecord[];
  disconnect(): void;
};

/** The longest line read as a notice: a sentence, not a section of the page. */
const LINE_MAX = 200;

/** The page-wide elements a region never widens to. */
const PAGE_TAGS = new Set(["body", "html"]);

/** The attributes a page shows a ready line by. */
const SHOWING_ATTRIBUTES = ["hidden", "class", "style", "aria-hidden"];

const OBSERVED: MutationObserverInit = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: SHOWING_ATTRIBUTES };

/** Anything that is a control of its own: a line holding one is a panel the press opened, not a notice. */
const CONTROL = 'a[href], button, input, select, textarea, [role="button"], [role="link"], [role="option"], [role="radio"], [role="checkbox"], [role="tab"], [role="menuitem"], [contenteditable="true"]';

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

function pageObserver(): LineObserver | undefined {
  return typeof MutationObserver === "function" ? new MutationObserver(() => undefined) : undefined;
}

/**
 * Starts watching, from just before the press on `pressed`, for lines written
 * into its region `levels` ancestors up. A page with no `MutationObserver` -- a
 * test's stand-in -- is watched for nothing.
 */
export function watchWrittenLines(pressed: Element, levels: number, makeObserver: () => LineObserver | undefined = pageObserver): WrittenLines {
  const observer = makeObserver();
  if (!observer) return { take: () => [], stop: () => undefined };
  const region = regionOf(pressed, levels);
  observer.observe(region, OBSERVED);
  for (const root of scopeRoots(pressed, region)) observer.observe(root, OBSERVED);
  let stopped = false;
  return {
    take() {
      if (stopped) return [];
      const lines: string[] = [];
      for (const element of changedElements(observer.takeRecords())) {
        const line = lineOf(element, pressed);
        if (line !== undefined && !lines.includes(line)) lines.push(line);
      }
      return lines;
    },
    stop() {
      if (stopped) return;
      stopped = true;
      observer.disconnect();
    }
  };
}

/** The outermost of the pressed control's composed ancestors, `levels` up, never the body or the document; the control itself when it has none. */
function regionOf(pressed: Element, levels: number): Element {
  let region = pressed;
  let current = composedParent(pressed);
  for (let level = 0; current && level < levels; level += 1) {
    if (PAGE_TAGS.has(String(current.tagName ?? "").toLowerCase())) break;
    region = current;
    current = composedParent(current);
  }
  return region;
}

/** Each element a record says the press changed, once, in the order changed. */
function changedElements(records: readonly MutationRecord[]): Element[] {
  const changed: Element[] = [];
  const add = (node: Node | null | undefined): void => {
    const element = node?.nodeType === ELEMENT_NODE ? (node as Element) : node?.nodeType === TEXT_NODE ? node.parentElement : null;
    if (element && !changed.includes(element)) changed.push(element);
  };
  for (const record of records) {
    if (record.type === "childList") {
      for (const node of Array.from(record.addedNodes)) add(node);
      // A line emptied and written in one go adds a text node; one emptied
      // alone adds nothing, and is read through its target as it now stands.
      if (record.addedNodes.length === 0) add(record.target);
    } else {
      add(record.target);
    }
  }
  return changed;
}

/** The line's text, or `undefined` when it is not a notice line: gone, not rendered, too long, empty, or a control or holding one. */
function lineOf(element: Element, pressed: Element): string | undefined {
  if (!element.isConnected) return undefined;
  const ownControl = element === pressed || pressed.contains?.(element) === true;
  if (!ownControl && (element.matches?.(CONTROL) === true || element.querySelector?.(CONTROL) != null)) return undefined;
  if (typeof element.getClientRects === "function" && element.getClientRects().length === 0) return undefined;
  const text = boundedLayerText(element);
  if (text.length === 0 || text.length > LINE_MAX) return undefined;
  return text;
}
