// Whether two elements are the same kind of element.

import type { ElementKind } from "./element-kind";

/**
 * The same tag, role, stated attributes and link folder, and classes that
 * overlap: a modifier class (`price price-sale`) leaves an element the kind it
 * was, while two elements that share no class at all are styled as different
 * things. Two unclassed elements share their (empty) classes.
 */
export function sameKind(left: ElementKind, right: ElementKind): boolean {
  if (left.tag !== right.tag || left.role !== right.role || left.href !== right.href) return false;
  if (left.stated.join(" ") !== right.stated.join(" ")) return false;
  if (left.classes.length === 0 || right.classes.length === 0) return left.classes.length === right.classes.length;
  return left.classes.some((name) => right.classes.includes(name));
}
