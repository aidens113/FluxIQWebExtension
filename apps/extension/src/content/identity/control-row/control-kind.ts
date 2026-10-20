// What kind of control an element is, for telling which controls are alike.

import { implicitRole } from "../implicit-role";

/** The element's role, written or implied, or its tag where it has neither. */
export function controlKind(element: Element): string {
  const written = element.getAttribute("role")?.trim().toLowerCase().split(/\s+/u)[0];
  return written || implicitRole(element) || (element.localName ?? element.tagName?.toLowerCase() ?? "");
}
