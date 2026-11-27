// What a candidate's own destination says of a marked target (`./index.ts`, t1071 F1).

import { isActionLink } from "../action-link";
import { NO_BASE } from "./no-base";
import { destinationRegion } from "./region";

/**
 * What `element`'s own destination says of a target that always led to
 * `destination` (header): `confirms`, it leads there and no other visible link
 * in its region does; `shared`, it leads there and so does another visible link
 * in its region, so the destination tells them apart no more than a tie;
 * `elsewhere`, it leads somewhere else or nowhere, or is not shown -- a closed
 * mini cart's link is no link a person could take for the one in the header.
 *
 * Its region is the nearest dialog or landmark it sits in (`./region.ts`, t1079
 * F2); a link in none has its whole root for a region, as before. A link to the
 * same place in another region -- an open drawer's "View cart" beside the
 * header's cart link -- is no rival: it is another place to go there from.
 */
export function destinationVerdict(destination: string, element: Element): "confirms" | "shared" | "elsewhere" {
  if (linkDestination(element) !== destination || !drawn(element)) return "elsewhere";
  const root = (element.getRootNode?.() ?? element.ownerDocument) as unknown as ParentNode | null;
  const region = destinationRegion(element);
  const links = root?.querySelectorAll?.("a[href], area[href]") ?? [];
  for (const link of links) {
    if (link === element || linkDestination(link) !== destination || !drawn(link)) continue;
    if (region === root || destinationRegion(link) === region) return "shared";
  }
  return "confirms";
}

/** Where a link leads within its own site, as its path and query; nothing for anything else (header, t1079 F1). */
function linkDestination(element: Element): string | undefined {
  const tag = element.tagName.toLowerCase();
  if ((tag !== "a" && tag !== "area") || isActionLink(element)) return undefined;
  const href = element.getAttribute("href")?.trim();
  const base = (element as { baseURI?: unknown }).baseURI;
  const page = typeof base === "string" && URL.canParse(base) ? base : NO_BASE;
  if (!href || !URL.canParse(href, page)) return undefined;
  const url = new URL(href, page);
  return url.origin === new URL(page).origin ? `${url.pathname}${url.search}` : undefined;
}

/** Shown with a box: a link a person could take for this one. */
function drawn(element: Element): boolean {
  const view = element.ownerDocument?.defaultView;
  const style = view?.getComputedStyle(element);
  if (style && (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse")) return false;
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0;
}
