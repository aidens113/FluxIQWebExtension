// A CSS selector naming exactly one element: the one it was built for, on the
// page as it is when it is built.
//
// Why exactly one. Every selector a snapshot carries is an address something
// downstream acts on: a plan's handle resolves to it
// (`domain/src/runtime/llm-evidence/plan-resolution/`), a replay tries it first
// (`action-runtime/resolve-target.ts`), and an extraction writes an item
// selector after a container's. When the catalog's eight product links all read
// `[data-testid="product-link"]`, the resolver could only refuse a plan naming
// one of them (`web.handle.not_unique`), and a replay of one clicked the first.
//
// How, strongest first:
//
// 1. The element's own anchor (`element-anchors.ts`) -- its id, test id or
//    name -- when that alone matches it and nothing else. An author wrote it to
//    name the element, so it survives a re-render.
// 2. The same anchor, scoped. When it repeats -- a link in every card -- it is
//    written after the selector of the largest ancestor holding no other match,
//    which is the card: `<card> [data-testid="product-link"]`.
// 3. One step down from the parent: the parent's selector, a child combinator,
//    and this element's tag, first anchor and `:nth-of-type` position --
//    `[data-testid="product-grid"] > article[data-testid="product-card"]:nth-of-type(3)`.
//    The climb ends at a unique ancestor, a `body` or `main` the document holds
//    once, or `:root`.
//
// Forms 2 and 3 are unique whenever the ancestor's selector is, which the same
// rules make it; form 1 is checked against the page, because an id is unique
// only when its author kept it so.
//
// Two limits. An element in a shadow tree is addressed within that tree, best
// effort: `document.querySelector` reaches neither form. And an element no
// longer in a document -- a control a click removed, described afterwards --
// can be checked against nothing, so it gets its first anchor or a short
// structural path, which is what every element got before this module.
//
// No page text and no control value is read here; see `element-anchors.ts`.

import { elementAnchors, type ElementAnchor } from "./element-anchors";
import { activeSelectorMemo, type SelectorMemo } from "./selector-memo";

const DOCUMENT_NODE = 9;
const DOCUMENT_FRAGMENT_NODE = 11;
const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

/** Elements a document usually holds once, and so end a climb when it does. Checked, never assumed. */
const SINGLETON_TAGS = new Set(["body", "main"]);

/** How far a detached element's path climbs: the depth every path had before this module. */
const MAX_DETACHED_STEPS = 5;

type SearchRoot = Document | ShadowRoot;

/** A selector that matches `element` and nothing else in its document (or shadow tree). */
export function selectorFor(element: Element): string {
  const memo = activeSelectorMemo();
  const known = memo?.selectors.get(element);
  if (known !== undefined) return known;
  const selector = buildSelector(element, memo);
  memo?.selectors.set(element, selector);
  return selector;
}

function buildSelector(element: Element, memo: SelectorMemo | undefined): string {
  const anchors = elementAnchors(element);
  const root = searchRoot(element);
  if (!root) return anchors[0]?.selector ?? detachedPath(element);
  if (root.nodeType === DOCUMENT_NODE && element === (root as Document).documentElement) return ":root";
  for (const anchor of anchors) {
    if (soleMatch(root, anchor.selector, memo) === element) return anchor.selector;
  }
  if (SINGLETON_TAGS.has(element.localName) && element.namespaceURI === HTML_NAMESPACE) {
    const tag = typeSelector(element);
    if (soleMatch(root, tag, memo) === element) return tag;
  }
  const first = anchors[0];
  const parent = element.parentElement;
  // The top of a shadow tree: there is no selector for the shadow root itself.
  if (!parent) return step(element, first);
  if (first) {
    const holder = soleHolder(element, first.selector);
    if (holder) return `${selectorFor(holder)} ${first.selector}`;
  }
  return `${selectorFor(parent)} > ${step(element, first)}`;
}

/** The document or shadow root a selector for `element` is resolved in, or `undefined` for a detached element. */
function searchRoot(element: Element): SearchRoot | undefined {
  if (!element.isConnected) return undefined;
  const root = element.getRootNode();
  if (root.nodeType === DOCUMENT_NODE) return root as Document;
  if (root.nodeType === DOCUMENT_FRAGMENT_NODE && "host" in root) return root as ShadowRoot;
  return undefined;
}

/** The one element `selector` matches in `root`, or `null` when it matches none, several, or is not a selector. */
function soleMatch(root: SearchRoot, selector: string, memo: SelectorMemo | undefined): Element | null {
  let known = memo?.soleMatches.get(root);
  const cached = known?.get(selector);
  if (cached !== undefined) return cached;
  let sole: Element | null = null;
  try {
    const matches = root.querySelectorAll(selector);
    sole = matches.length === 1 ? matches[0] ?? null : null;
  } catch {
    sole = null;
  }
  if (memo) {
    if (!known) {
      known = new Map();
      memo.soleMatches.set(root, known);
    }
    known.set(selector, sole);
  }
  return sole;
}

/**
 * The largest ancestor in which `selector` matches only `element`, or
 * `undefined` when the parent already holds another match. For a link repeated
 * in every card, that is the card.
 */
function soleHolder(element: Element, selector: string): Element | undefined {
  let holder: Element | undefined;
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    if (matchCountWithin(ancestor, selector) !== 1) break;
    holder = ancestor;
  }
  return holder;
}

function matchCountWithin(ancestor: Element, selector: string): number {
  try {
    return ancestor.querySelectorAll(selector).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/** One structural step: tag, the first anchor as a qualifier, and the position among same-type siblings when there are any. */
function step(element: Element, anchor: ElementAnchor | undefined): string {
  return `${typeSelector(element)}${anchor?.qualifier ?? ""}${position(element)}`;
}

function typeSelector(element: Element): string {
  return CSS.escape(element.localName);
}

/** `:nth-of-type(n)` when a sibling shares the element's type, or nothing when it is the only one. */
function position(element: Element): string {
  let index = 1;
  for (let sibling = element.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
    if (sameType(sibling, element)) index += 1;
  }
  let shared = index > 1;
  for (let sibling = element.nextElementSibling; sibling && !shared; sibling = sibling.nextElementSibling) {
    if (sameType(sibling, element)) shared = true;
  }
  return shared ? `:nth-of-type(${index})` : "";
}

function sameType(left: Element, right: Element): boolean {
  return left.localName === right.localName && left.namespaceURI === right.namespaceURI;
}

/** Up to five structural steps, for an element no document can check a selector against. */
function detachedPath(element: Element): string {
  const steps: string[] = [];
  for (let current: Element | null = element; current && steps.length < MAX_DETACHED_STEPS; current = current.parentElement) {
    steps.unshift(`${typeSelector(current)}${position(current)}`);
  }
  return steps.join(" > ");
}
