// The label a person reads beside a control: the `<label>` the page associated
// with it, or, when the page associated none, the nearest label-shaped text
// before it. Core's fingerprint scores `label` as a text signal of its own,
// separate from the accessible name, so a control keeps a second identity
// signal when its name changes (Phase 1.3).
//
// Only label text is read. A control's own value is never part of a label --
// the collector skips nested controls -- so no value can reach the wire through
// this path and the sensitivity rule in shared/sensitive-field.ts stays the one
// place that decides which values must never leave the page.

import { boundedText } from "./bounded-text";

const MAX_LABEL_LENGTH = 200;
/** A nearby label is short by nature; longer text beside a control is prose, not a label. */
const MAX_NEARBY_LABEL_LENGTH = 80;
const MAX_ASSOCIATED_LABELS = 4;
const MAX_NEARBY_SIBLINGS = 4;
const NEARBY_LABEL_TAGS = new Set(["label", "span", "div", "p", "dt", "strong", "b", "legend", "th"]);
const NESTED_CONTROL_SELECTOR = "input,select,textarea,button";

/** The text of every `<label>` the page associates with `element`, in document order. */
export function associatedLabel(element: Element): string | undefined {
  const texts = associatedLabelElements(element).map((label) => labelElementText(label, element));
  return boundedText(texts.filter(Boolean).join(" "), MAX_LABEL_LENGTH);
}

/**
 * The label signal for the descriptor: the associated `<label>` when there is
 * one, otherwise the nearest label-shaped text before an unlabelled control.
 */
export function labelText(element: Element): string | undefined {
  return associatedLabel(element) ?? nearbyLabel(element);
}

/**
 * `HTMLElement.labels` already answers both association forms -- `for="id"` and
 * an ancestor `<label>` -- for every labelable control, so it is preferred; the
 * fallback covers anything else the page labelled by hand.
 */
function associatedLabelElements(element: Element): Element[] {
  const native = (element as Element & { labels?: NodeListOf<HTMLLabelElement> | null }).labels;
  if (native) return [...native].slice(0, MAX_ASSOCIATED_LABELS);
  const labels: Element[] = [];
  if (element.id) {
    for (const label of document.querySelectorAll(`label[for="${cssString(element.id)}"]`)) labels.push(label);
  }
  const ancestor = element.closest("label");
  if (ancestor && !labels.includes(ancestor)) labels.push(ancestor);
  return labels.slice(0, MAX_ASSOCIATED_LABELS);
}

/** A label's own words: its text nodes, with any nested control's content left out. */
function labelElementText(label: Element, control: Element): string {
  const parts: string[] = [];
  collectLabelText(label, control, parts, 0);
  return parts.join(" ").replace(/\s+/gu, " ").trim();
}

function collectLabelText(node: Node, control: Element, parts: string[], depth: number): void {
  if (parts.length > 40 || depth > 8) return;
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent;
    if (text?.trim()) parts.push(text);
    return;
  }
  if (!(node instanceof Element)) return;
  if (node === control || node.matches(NESTED_CONTROL_SELECTOR)) return;
  for (const child of node.childNodes) collectLabelText(child, control, parts, depth + 1);
}

/**
 * An unlabelled control takes the nearest label-shaped element before it: a
 * short piece of text that holds no control of its own. Restricting this to
 * labelable controls keeps it from inventing labels for ordinary containers.
 */
function nearbyLabel(element: Element): string | undefined {
  if (!isLabelableControl(element)) return undefined;
  const fromSiblings = labelBeforeSiblings(element);
  if (fromSiblings) return fromSiblings;
  const wrapper = element.parentElement;
  return wrapper?.childElementCount === 1 ? labelBeforeSiblings(wrapper) : undefined;
}

function labelBeforeSiblings(element: Element): string | undefined {
  let sibling = element.previousElementSibling;
  let scanned = 0;
  while (sibling && scanned < MAX_NEARBY_SIBLINGS) {
    scanned += 1;
    const text = nearbyLabelText(sibling);
    if (text) return text;
    sibling = sibling.previousElementSibling;
  }
  return undefined;
}

function nearbyLabelText(candidate: Element): string | undefined {
  if (!NEARBY_LABEL_TAGS.has(candidate.tagName.toLowerCase())) return undefined;
  if (candidate.querySelector(NESTED_CONTROL_SELECTOR)) return undefined;
  return boundedText(candidate.textContent, MAX_NEARBY_LABEL_LENGTH);
}

function isLabelableControl(element: Element): boolean {
  if (element instanceof HTMLInputElement) return element.type.toLowerCase() !== "hidden";
  if (element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) return true;
  return element instanceof HTMLElement && element.isContentEditable;
}

function cssString(value: string): string {
  return CSS.escape(value).replace(/"/gu, '\\"');
}
