// The text of an element that may leave the page. `textContent` quotes
// everything inside an element, and part of that can be what a sensitive
// control holds: a sensitive `<textarea>`'s text, a sensitive `<select>`'s
// option labels, the words in an editable region marked `data-sensitive`.
// That is the control's value in another form, so it follows the rule
// `readElementValue` follows and never leaves the page. This is decision D2 of
// the data-extraction plan, and this is its one text reader, so no two paths
// can disagree about what is left out: `describe-element.ts` reads the text of
// the descriptor every snapshot and recorded event carries through it,
// `identity/accessible-name.ts` every computed name -- the descriptor's, page
// evidence's and the resolver's -- `identity/context.ts` the legend, heading,
// column header and landmark name in a descriptor's `context`,
// `identity/label.ts` the text beside an unlabelled control, and
// `action-runtime/extract.ts` the text an extract read or a list field returns.
//
// `isWithinSensitiveControl` is the first of the two rules below on its own,
// for a caller that must refuse rather than read -- `extract.ts`, whose target
// may sit inside a sensitive control -- or that walks text itself: the
// `<label>` reader, which also skips nested controls.
//
// Two rules, each asking the one shared sensitivity rule through
// `isSensitiveFormControl` rather than restating it:
// - an element that is, or sits inside, a sensitive control gives no text --
//   which covers the `<option>`s a listbox renders, and a snapshot can
//   describe on their own;
// - any other element's text leaves out every subtree rooted at a sensitive
//   control inside it, so a `<label>` wrapping a sensitive textarea still
//   reads as its label.
//
// A read that reaches no sensitive control returns the text unchanged, and an
// element with no words in it costs nothing more. Otherwise the cost is a walk
// up the ancestors and a scan of the descendants that have children: a
// childless control -- a password `<input>`, say -- holds no text, so the rule
// is not asked of it.

import { isSensitiveFormControl } from "./element-traits";

/**
 * The element's text with every sensitive control's contents left out, and
 * `""` when the element is, or sits inside, a sensitive control. `"all"` reads
 * as `textContent` does; `"own"` reads only the element's own text nodes,
 * joined by a space, so a container does not inherit its children's words;
 * `"readable"` reads as `"all"` does, but with a space where the page lays a
 * child out as a block of its own (`readableText`). Whitespace is returned as
 * found; collapsing it is the caller's.
 */
export function textOutsideSensitiveControls(element: Element, extent: "all" | "own" | "readable" = "all"): string {
  const text = extent === "own" ? ownText(element) : element.textContent ?? "";
  if (!/\S/u.test(text)) return text;
  if (isWithinSensitiveControl(element)) return "";
  if (extent === "own") return text;
  if (extent === "readable" && laidOut(element)) return readableText(element);
  if (!hasTextBearingSensitiveDescendant(element)) return text;
  return textSkippingSensitiveSubtrees(element);
}

/** The element's own text nodes, joined by a space: one pass over its child nodes, with no copy of the list. */
function ownText(element: Element): string {
  const pieces: string[] = [];
  const children = element.childNodes;
  for (let index = 0; index < children.length; index += 1) {
    const node = children[index];
    if (node && node.nodeType === Node.TEXT_NODE) pieces.push(node.textContent ?? "");
  }
  return pieces.join(" ");
}

/**
 * Whether the element is, or sits inside, a sensitive control, so that what it
 * holds -- its text, its attributes, its markup -- is that control's contents.
 * It reads no text, so an empty element inside one is inside it all the same.
 */
export function isWithinSensitiveControl(element: Element): boolean {
  for (let current: Element | null = element; current; current = current.parentElement) {
    if (isSensitiveFormControl(current)) return true;
  }
  return false;
}

function hasTextBearingSensitiveDescendant(root: Element): boolean {
  for (const descendant of root.querySelectorAll("*")) {
    if (descendant.firstChild && isSensitiveFormControl(descendant)) return true;
  }
  return false;
}

/**
 * The text a reader sees as words: `textContent`, less every subtree rooted at
 * a sensitive control, with a space wherever the page lays a child out as a
 * block of its own -- a block, a flex or grid item, a list item, a table part,
 * a line break -- and the text on either side would otherwise run together.
 * `textContent` joins every piece with nothing between, so a store chip drawn
 * as two stacked lines read "Pickup or delivery?Carden Falls Supercenter" and a
 * cart link "🛒1$3.97" (lane B's bigbox run, 2026-10-01). Inline pieces stay
 * joined, as a reader sees them: `$10<sup>47</sup>`, `Ultra<b>Strong</b>`.
 * Without a window -- a Node test -- nothing is laid out, and the text is
 * `textContent`'s.
 */
function readableText(root: Element): string {
  const view = root.ownerDocument?.defaultView ?? undefined;
  let text = "";
  let breakBefore = false;
  const add = (piece: string): void => {
    if (!piece) return;
    if (breakBefore && text !== "" && !/\s$/u.test(text) && !/^\s/u.test(piece)) text += " ";
    breakBefore = false;
    text += piece;
  };
  const walk = (parent: Node): void => {
    for (const child of [...parent.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        add(child.nodeValue ?? "");
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE || isSensitiveFormControl(child as Element)) continue;
      const block = laidOutAsBlock(child as Element, view);
      if (block) breakBefore = true;
      walk(child);
      if (block) breakBefore = true;
    }
  };
  walk(root);
  return text;
}

/** Whether the element is in a window that lays pages out, so how a child is laid out can be asked; a Node test's stand-in is not. */
function laidOut(element: Element): boolean {
  const view = element.ownerDocument?.defaultView;
  return Boolean(view && typeof view.getComputedStyle === "function" && (element.childNodes?.length ?? 0) > 0);
}

/** Whether the page lays the element out as a block of its own: anything but an inline, `contents` or undrawn box, and a line break. */
function laidOutAsBlock(element: Element, view: Window | undefined): boolean {
  if (element.tagName === "BR") return true;
  if (!view || typeof view.getComputedStyle !== "function") return false;
  const display = view.getComputedStyle(element)?.display;
  return typeof display === "string" && display !== "" && !display.startsWith("inline") && display !== "contents" && display !== "none";
}

/** `textContent`, less every subtree rooted at a sensitive control, in document order. */
function textSkippingSensitiveSubtrees(root: Element): string {
  let text = "";
  const pending: Node[] = [...root.childNodes].reverse();
  for (let node = pending.pop(); node; node = pending.pop()) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.nodeValue ?? "";
    } else if (node.nodeType === Node.ELEMENT_NODE && !isSensitiveFormControl(node as Element)) {
      const children = node.childNodes;
      for (let index = children.length - 1; index >= 0; index -= 1) {
        const child = children[index];
        if (child) pending.push(child);
      }
    }
  }
  return text;
}
