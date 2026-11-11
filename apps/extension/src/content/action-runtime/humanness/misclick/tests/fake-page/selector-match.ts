// Part of the page the misclick tests build by hand (`../misclick.test.ts`,
// `actions/tests/click/tests/misclick.test.ts`). Node has no DOM, so only what
// the misclick and the click verb read is faked; see `index.ts`.

import type { FakeElement } from "./fake-element";

/** `tag`, `*`, `:popover-open`, and a tag or nothing followed by `[name]` or `[name="value"]` groups. Anything else matches nothing. */
export function matchesFakeSelector(element: FakeElement, selector: string): boolean {
  if (selector === "*") return true;
  if (selector === ":popover-open") return element.popoverOpen;
  const parsed = /^([a-z][a-z0-9-]*)?((?:\[[a-z-]+(?:="[^"]*")?\])*)$/i.exec(selector);
  if (!parsed) return false;
  const [, tag, groups = ""] = parsed;
  if (tag && tag.toUpperCase() !== element.tagName) return false;
  if (!tag && !groups) return false;
  for (const [, name, value] of groups.matchAll(/\[([a-z-]+)(?:="([^"]*)")?\]/gi)) {
    if (!element.hasAttribute(name!)) return false;
    if (value !== undefined && element.getAttribute(name!) !== value) return false;
  }
  return true;
}
