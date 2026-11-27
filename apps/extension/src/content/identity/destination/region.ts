// The part of the page a link sits in, which is where its rivals are counted (`./index.ts`, t1079 F2).

import { landmarkRole } from "../context";

/** How far up a region is looked for; the same reach `../context.ts` gives a landmark. */
const MAX_REGION_DEPTH = 30;
const DIALOG_ROLES: ReadonlySet<string> = new Set(["dialog", "alertdialog"]);

/**
 * The nearest dialog or landmark at or above `element` -- the header's links,
 * a results page's pagination, a drawer -- or its root when it sits in none
 * (header). Two links are rivals only within one region: the header's cart link
 * and an open drawer's "View cart" are two places a person goes to the cart from,
 * not two readings of one control.
 */
export function destinationRegion(element: Element): Element | Node | null {
  let current: Element | null = element;
  for (let depth = 0; current && depth < MAX_REGION_DEPTH; depth += 1) {
    if (isDialog(current) || landmarkRole(current) !== undefined) return current;
    current = current.parentElement;
  }
  return element.getRootNode?.() ?? element.ownerDocument;
}

function isDialog(element: Element): boolean {
  const tag = element.localName ?? element.tagName?.toLowerCase();
  if (tag === "dialog" || element.getAttribute("aria-modal")?.trim().toLowerCase() === "true") return true;
  const role = element.getAttribute("role")?.trim().toLowerCase().split(/\s+/u)[0];
  return role !== undefined && DIALOG_ROLES.has(role);
}
