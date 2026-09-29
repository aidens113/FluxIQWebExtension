// The page as it is painted, rather than as one document tree: every open
// shadow root is part of it, reached through its host.
//
// `querySelectorAll`, `closest`, `contains` and `parentElement` each stop at a
// shadow boundary, and `document.elementFromPoint` answers with the outermost
// host. So a consent platform or chat vendor that ships its buttons inside a
// custom element's shadow root had controls that nothing in the content script
// could see: on the job board (`run-mulwm2dc-0bd95f22`) the consent wall's
// Accept, Reject and Manage buttons were in no snapshot, so the model had no
// handle to answer the wall with and half the build loop stalled behind it.
//
// These are the walks that cross the boundary, written once so that the
// snapshot, the resolver, the actionability gate and the interference scans do
// not each grow their own copy: upward and sideways here, downward -- the roots
// and descendants beneath a point -- in `composed-roots.ts`. The point lookup
// that descends through roots is `../selector/shadow/element-from-point.ts`,
// and is not repeated here.
//
// **Closed roots.** A root attached with `mode: "closed"` is not reachable:
// its host's `shadowRoot` is `null`, so nothing here ever enters one, and a
// closed widget is described, hit-tested and pressed as its host alone -- as
// the browser's own hit test and every event retargeted to that host already
// present it. Nothing here throws on one; an element inside one can never be
// handed to these functions from outside it in the first place.

import { isShadowRoot } from "./is-shadow-root";

/** `Node.DOCUMENT_POSITION_FOLLOWING`, written out so the module loads where there is no `Node` global. */
const DOCUMENT_POSITION_FOLLOWING = 4;

/** The element's parent in the painted tree: its parent element, or the host of the shadow root it sits at the top of. */
export function composedParent(element: Element): Element | null {
  if (element.parentElement) return element.parentElement;
  const parent = element.parentNode;
  return isShadowRoot(parent) ? parent.host : null;
}

/** `Element.closest`, continued past every shadow boundary into the host's tree. */
export function composedClosest(element: Element, selector: string): Element | null {
  for (let current: Element | null = element; current; current = composedParent(current)) {
    if (current.matches(selector)) return current;
  }
  return null;
}

/** Whether `node` is `ancestor` or inside it, crossing shadow boundaries, which `Node.contains` does not. */
export function composedContains(ancestor: Element, node: Node | null): boolean {
  for (let current: Node | null = node; current; current = isShadowRoot(current) ? current.host : current.parentNode) {
    if (current === ancestor) return true;
  }
  return false;
}

/** The shadow hosts around the element, innermost first; empty for an element of the document. */
export function shadowHostsOf(element: Element): Element[] {
  const hosts: Element[] = [];
  for (let root = element.getRootNode(); isShadowRoot(root); root = root.host.getRootNode()) hosts.push(root.host);
  return hosts;
}

/**
 * Document order across shadow boundaries: a host precedes what its root
 * holds, and a root's content sits where its host sits. `compareDocumentPosition`
 * calls two elements in different trees "disconnected" and orders them by an
 * implementation detail, which is no order a reader would recognise.
 */
export function composedDocumentOrder(left: Element, right: Element): number {
  if (left === right) return 0;
  const leftPath = treePath(left);
  const rightPath = treePath(right);
  for (let depth = 0; ; depth += 1) {
    const a = leftPath[depth];
    const b = rightPath[depth];
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    if (a === b) continue;
    return a.compareDocumentPosition(b) & DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  }
}

/** The element's stand-in at each tree level, outermost first: its outermost host, each host inside that, then the element. */
function treePath(element: Element): Element[] {
  return [...shadowHostsOf(element).reverse(), element];
}
