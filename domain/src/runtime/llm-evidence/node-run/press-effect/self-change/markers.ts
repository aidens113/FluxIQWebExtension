// What the page's own markup says changes by itself (t1043): an element whose role or
// description says it rotates, ticks or scrolls on its own, and the live regions a page
// announces into.
//
// - **Changing by itself, by its own markup** (`"rotates"`): a carousel or one of its
//   slides, by the `aria-roledescription` ARIA's carousel pattern writes on them; an
//   element whose role is `marquee` or `timer`, which ARIA defines as content that
//   changes on its own; a `<marquee>`. Whatever changes inside one may be the page's
//   doing whether or not anything was pressed.
// - **A live region** (`"live"`): `aria-live` polite or assertive, or a role of
//   `status`, `alert` or `log`. A page announces into one whatever caused it -- very
//   often the press itself ("Added to cart", a cart total) -- so its markup alone says
//   nothing about who changed it. It counts as changing by itself only where the run
//   has also seen something in it change with nothing done (`./own-changes.ts`).
//
// Read from the attributes and role the page wrote, never from its words.

import type { WebLlmEvidenceElement } from "../../../elements";
import { attributeValue } from "../../../page-view";

/** What ARIA's carousel pattern calls a carousel and its slides, and the words pages write for the same thing. */
const ROTATING_DESCRIPTION = /\b(?:carousel|slides?|slideshow)\b/iu;
/** Roles ARIA defines as content that changes by itself. */
const ROTATING_ROLES: ReadonlySet<string> = new Set(["marquee", "timer"]);
/** Roles a page announces into. */
const LIVE_ROLES: ReadonlySet<string> = new Set(["status", "alert", "log"]);
const LIVE_POLITENESS: ReadonlySet<string> = new Set(["polite", "assertive"]);

/** `"rotates"` where the element's markup says its content changes by itself, `"live"` for a live region, else nothing. */
export function webSelfChangingMarkup(element: WebLlmEvidenceElement): "rotates" | "live" | undefined {
  // The first role token is the one a reader uses; later ones are fallbacks.
  const role = (element.role ?? attributeValue(element, "role") ?? "").trim().toLowerCase().split(/\s+/u)[0] ?? "";
  if (element.tag.toLowerCase() === "marquee" || ROTATING_ROLES.has(role)) return "rotates";
  if (ROTATING_DESCRIPTION.test(attributeValue(element, "aria-roledescription") ?? "")) return "rotates";
  if (LIVE_ROLES.has(role) || LIVE_POLITENESS.has((attributeValue(element, "aria-live") ?? "").trim().toLowerCase())) return "live";
  return undefined;
}
