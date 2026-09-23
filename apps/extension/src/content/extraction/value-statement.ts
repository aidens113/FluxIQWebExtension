// The page's own tightest statement of a value, which is what a field should
// read rather than the sentence that wraps it.
//
// **Why this exists.** A nine-node Flow replayed on the everything store's
// search results, branched correctly, read twelve records carrying all four
// requested columns, and matched no expected row at all: every record's rating
// read `3.7 out of 5 stars` where `3.7` was expected, and seven of the twelve
// differed on nothing else (`test-runs/instances/r5/run-mudwci8d-de88aa32`).
// The extraction found the right element; it returned the sentence the page
// wraps the number in.
//
// **What is deliberately not here.** No word list, no suffix or prefix
// stripping, no pattern over natural language. `domain/src/actions/extraction/
// request.ts` sets that rule out for item conditions and the reasoning is the
// same here: this repository deleted a word-list heuristic on 2026-09-18 and
// does not want it back under another name. A value is told from the sentence
// around it by the mark the page's own author put on it, never by reading its
// words and guessing. Every rule below is such a mark:
//
// - **microdata.** `itemprop` with a `content` attribute is the author saying
//   in so many words that the element's text is a rendering and `content` is
//   the value -- exactly what `<time itemprop="startDate" content="2026-01-02">
//   Jan 2nd</time>` means. An element that is itself an `itemscope` is skipped:
//   its properties belong to the item it opens, and choosing one of them would
//   be a guess;
// - **`aria-valuenow`**, which ARIA defines as the current value of the widget
//   it sits on, stated as a number and nothing else;
// - **`aria-label`, only where it states the value alone**: the label must
//   occur verbatim inside the element's own text and be shorter than it. So a
//   label that restates part of what the element says is used, and one that
//   phrases something else -- `16,733 ratings` beside the text `(16,733)` -- is
//   not;
// - **a paired rendering.** A page that draws one value twice marks one of the
//   two copies `aria-hidden="true"`: the store's rating is
//   `<span aria-hidden="true">3.7</span>` beside `<i><span>3.7 out of 5 stars
//   </span></i>`, and its price is an off-screen `$79.99` beside an
//   `aria-hidden` composition of the same amount in pieces. That attribute is
//   the page saying these two are one value, so where one copy's whole text
//   occurs verbatim inside the other's, the shorter copy is the tighter
//   statement of it.
//
// **Why the pairing needs that mark, and cannot be containment alone.**
// Verbatim containment between two sibling subtrees happens constantly without
// meaning anything: the store's brand line reads `Kinetra` beside a title that
// begins `Kinetra Run Wireless Earbuds`, and a rule that took the shorter of
// any contained pair would drop every product title on the page. `aria-hidden`
// is what separates two renderings of one value from two different values that
// happen to share words.
//
// Text is read through the one sensitive-text reader, so a sensitive control's
// contents never decide what a value is and are never returned (decision D2):
// a sensitive subtree reads as empty, and an empty statement is no statement.

import { isWithinSensitiveControl, textOutsideSensitiveControls } from "../sensitive-text";

/** How far a read descends through paired renderings before it stops looking. */
const MAX_STATEMENT_DEPTH = 8;

/**
 * The page's own tightest statement of the value `element` shows, or
 * `undefined` where the page states nothing tighter than the element's whole
 * text and the caller should read that as it always has.
 */
export function tightestStatedValue(element: Element): string | undefined {
  let current = element;
  let value: string | undefined;
  for (let depth = 0; depth < MAX_STATEMENT_DEPTH; depth += 1) {
    const text = statedText(current);
    const declared = statedByAttribute(current, text) ?? statedByProperty(current, text);
    if (declared !== undefined) return declared;
    const tighter = tighterPairedChild(current, text);
    if (tighter === undefined) return value;
    current = tighter;
    value = statedText(current);
  }
  return value;
}

/**
 * Whether the page states this element's value more tightly somewhere else it
 * has marked as the same value, so proposing this element would offer a column
 * of the sentence beside a column of the value.
 *
 * The element is carried up to the highest ancestor inside `item` that states
 * exactly what it states and nothing more -- the store's rating sentence is a
 * span inside an `<i>` that holds nothing else -- because that is the level at
 * which the page's two renderings sit beside each other.
 */
export function statedMoreTightly(item: Element, element: Element): boolean {
  const text = statedText(element);
  if (!text) return false;
  let top = element;
  for (;;) {
    const parent = top.parentElement;
    if (!parent || parent === item || !item.contains(parent) || statedText(parent) !== text) break;
    top = parent;
  }
  const parent = top.parentElement;
  if (!parent || !(parent === item || item.contains(parent))) return false;
  for (const sibling of parent.children) {
    if (sibling === top || markedDecorative(sibling) === markedDecorative(top)) continue;
    const other = statedText(sibling);
    if (other && other.length < text.length && text.includes(other)) return true;
  }
  return false;
}

/** The element's text as every other reader here takes it: collapsed, with no sensitive control's contents in it. */
function statedText(element: Element): string {
  return collapsed(textOutsideSensitiveControls(element));
}

/** Whether the page marked this subtree as the copy of a value that assistive technology should skip. */
function markedDecorative(element: Element): boolean {
  return element.getAttribute("aria-hidden") === "true";
}

/** A value the element itself declares, stated alone: microdata's `content`, `aria-valuenow`, or an `aria-label` that restates part of its own text. */
function statedByAttribute(element: Element, text: string): string | undefined {
  if (element.hasAttribute("itemprop") && !element.hasAttribute("itemscope")) {
    const content = collapsed(element.getAttribute("content") ?? "");
    if (content) return content;
  }
  const valueNow = collapsed(element.getAttribute("aria-valuenow") ?? "");
  if (valueNow) return valueNow;
  const label = collapsed(element.getAttribute("aria-label") ?? "");
  return label && label.length < text.length && text.includes(label) ? label : undefined;
}

/**
 * The one microdata property inside the element that states part of what the
 * element says, more tightly. An element that opens an `itemscope` of its own
 * is left alone -- its properties describe that item, and there is no saying
 * which of them the field wanted -- and a property nested inside a deeper
 * `itemscope` belongs to that item rather than this one. Two candidates mean
 * the page states more than one value here, so nothing is chosen.
 */
function statedByProperty(element: Element, text: string): string | undefined {
  if (element.hasAttribute("itemscope") || element.children.length === 0) return undefined;
  let found: string | undefined;
  for (const candidate of element.querySelectorAll("[itemprop]")) {
    if (candidate.hasAttribute("itemscope") || withinNestedScope(element, candidate) || isWithinSensitiveControl(candidate)) continue;
    const stated = collapsed(candidate.getAttribute("content") ?? "") || statedText(candidate);
    if (!stated || stated.length >= text.length || !text.includes(stated)) continue;
    if (found !== undefined) return undefined;
    found = stated;
  }
  return found;
}

/** Whether an `itemscope` stands between the element and the candidate, making the candidate another item's property. */
function withinNestedScope(element: Element, candidate: Element): boolean {
  for (let current = candidate.parentElement; current && current !== element; current = current.parentElement) {
    if (current.hasAttribute("itemscope")) return true;
  }
  return false;
}

/**
 * The child that states, more tightly, what this element states twice: of the
 * children whose texts contain one another across the page's own
 * `aria-hidden` mark, the shortest. `undefined` where the element draws its
 * value once, or where the tighter copy is the whole of the element's text and
 * so says nothing new.
 */
function tighterPairedChild(element: Element, text: string): Element | undefined {
  const children = Array.from(element.children, (child) => ({ child, text: statedText(child), decorative: markedDecorative(child) }));
  if (children.length < 2) return undefined;
  let tightest: { child: Element; text: string } | undefined;
  for (let index = 0; index < children.length; index += 1) {
    for (let other = index + 1; other < children.length; other += 1) {
      const left = children[index];
      const right = children[other];
      if (!left || !right || left.decorative === right.decorative || !left.text || !right.text) continue;
      if (!left.text.includes(right.text) && !right.text.includes(left.text)) continue;
      const shorter = left.text.length <= right.text.length ? left : right;
      if (!tightest || shorter.text.length < tightest.text.length) tightest = shorter;
    }
  }
  return tightest && tightest.text !== text ? tightest.child : undefined;
}

function collapsed(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}
