// The control on the page to press for a route a passed-over step owes (t1083):
// a link the page shows whose address resolves to the same route, its `?` query
// aside (`./owed-route.ts`).
//
// Which one, when several go there: a link in the page's banner or navigation
// first -- the header's cart link stands on every page, even where the capture
// places a sticky header in its front layer -- then one in the page's own body,
// and one inside a layer over the page (a dialog, or a drawer or panel that covers
// other controls) last: a layer is what came and went in the first place. Within
// each, the first in document order. Only a link a press reaches is offered: one
// the capture marks hidden, painted over by something that takes its click, or in
// a child frame (whose address is not the tab's) is passed over.
//
// An effect signed before t1083 knows only the route's path shape, which many
// addresses share (every product page is `/ip/#`). A press is offered for it only
// when every link on the page with that shape goes to one path: a choice among
// several is not this host's to guess, and the recorded destination is not there
// to settle it.

import type { WebLlmEvidenceElement, WebLlmSnapshotBinding } from "../llm-evidence";
import type { WebOwedRoute } from "./owed-route";

/** Landmarks that hold the links a site keeps on every page. */
const STANDING_LANDMARKS: ReadonlySet<string> = new Set(["banner", "navigation"]);

/** The selector of the link to press for `route`, or nothing when the page shows none, or only an ambiguous choice (header). */
export function webRouteLinkSelector(binding: WebLlmSnapshotBinding, route: WebOwedRoute): string | undefined {
  const { evidence, selectors } = binding;
  const byTarget = new Map(evidence.elements.map((element) => [element.target, element]));
  const going = evidence.elements.filter((element) => pressable(element) && element.href !== undefined && route.holds(element.href));
  if (going.length === 0) return undefined;
  if (route.destination === undefined && new Set(going.map((element) => pathOf(element.href!))).size > 1) return undefined;
  const ranked = going.map((element, order) => ({ element, order, rank: rankOf(element, byTarget) })).sort((left, right) => left.rank - right.rank || left.order - right.order);
  for (const { element } of ranked) {
    const selector = selectors.get(element.target);
    if (selector !== undefined) return selector;
  }
  return undefined;
}

/** A link of the tab's own document a press reaches (header). */
function pressable(element: WebLlmEvidenceElement): boolean {
  if (element.hidden === true || element.frameId !== undefined || (element.coveredBy?.length ?? 0) > 0) return false;
  return element.tag === "a" || element.role === "link" || element.implicitRole === "link";
}

/** 0 in a banner or navigation, 1 in the page's body, 2 inside a layer over the page (header). */
function rankOf(element: WebLlmEvidenceElement, byTarget: ReadonlyMap<string, WebLlmEvidenceElement>): number {
  if (element.landmark !== undefined && STANDING_LANDMARKS.has(element.landmark)) return 0;
  return inLayer(element, byTarget) ? 2 : 1;
}

/** Whether the element, or an element it sits in, is a layer over the page: a dialog, or a panel that covers other controls. */
function inLayer(element: WebLlmEvidenceElement, byTarget: ReadonlyMap<string, WebLlmEvidenceElement>): boolean {
  const seen = new Set<string>();
  for (let at: WebLlmEvidenceElement | undefined = element; at !== undefined && !seen.has(at.target); at = at.parent === undefined ? undefined : byTarget.get(at.parent)) {
    seen.add(at.target);
    if (at.inDialog !== undefined || at.isDialog !== undefined || (at.covers?.length ?? 0) > 0 || (at.coversCount ?? 0) > 0) return true;
  }
  return false;
}

/** An address's path, for telling apart the paths links of one shape go to. */
function pathOf(address: string): string {
  return URL.canParse(address) ? new URL(address).pathname : address;
}
