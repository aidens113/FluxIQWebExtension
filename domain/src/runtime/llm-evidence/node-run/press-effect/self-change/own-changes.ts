// Which elements of a page change by themselves, so a press is never credited with what
// the page did on its own while it was pressed (t1043).
//
// **Why.** Run `run-mww6euuw-ecdb20f8` pressed "Accept all" on a cookie banner while the
// home page's carousel moved to its next slide, as it does every few seconds. The press's
// answer said the slide's heading and text read otherwise (`how: "reads"`), Core took
// that for a change the press made that stays (`changedState`), carried the press into
// the next attempt as an act, and that attempt's judge was given a before side nobody
// could read. The same holds for any page with a carousel, a ticker, a clock or a live
// region.
//
// **The page's own, by two honest signals**, from the looks on both sides of the press:
//
//   - its own markup (`./markers.ts`): everything inside an element that says it rotates
//     (a carousel, a slide, a marquee, a timer), and everything inside a live region in
//     which the run has seen a line change with nothing done;
//   - what the run has seen (`./memory.ts`): a line, by its stable handle, seen changing
//     with nothing done between two captures.
//
// **Unless the press reached it.** A press on a control inside such an element, or one
// whose `aria-controls` names it, changes it itself (a carousel's next arrow, a pause
// button): the element's changes are then the press's. A line seen changing by itself
// is the press's when the press was made on it or on a control around or inside it.
//
// Nothing here waits or times anything: whether the page moved during the press is read
// from what the page says of itself and from what the run already saw.

import type { WebLlmEvidenceElement } from "../../../elements";
import { attributeValue, webLlmPageTree } from "../../../page-view";
import type { WebLlmPageEvidence, WebLlmSnapshotBinding } from "../../../sanitize";
import { webSelfChangingMarkup } from "./markers";
import { webPressSeenChanging } from "./memory";

const NONE: ReadonlySet<string> = new Set();

/** The handles of every element whose changes between `before` and `after` are the page's own, the press on `handle` having been made between them. */
export function webPageOwnChanges(before: WebLlmSnapshotBinding | undefined, after: WebLlmSnapshotBinding | undefined, handle: string | undefined): ReadonlySet<string> {
  const seen = new Set([...webPressSeenChanging(before), ...webPressSeenChanging(after)]);
  const own = new Set<string>();
  for (const page of [before?.evidence, after?.evidence]) if (page !== undefined) ownOn(page, handle, seen, own);
  return own.size === 0 ? NONE : own;
}

function ownOn(page: WebLlmPageEvidence, handle: string | undefined, seen: ReadonlySet<string>, own: Set<string>): void {
  const tree = webLlmPageTree(page.elements);
  const pressed = handle === undefined ? undefined : page.elements.find((element) => element.target === handle);
  const controlled = new Set((pressed === undefined ? "" : attributeValue(pressed, "aria-controls") ?? "").split(/\s+/u).filter((id) => id !== ""));
  const reached = (element: WebLlmEvidenceElement): boolean => pressed !== undefined && (pressed === element || tree.isUnder(pressed, element) || tree.isUnder(element, pressed));
  const holdsSeen = (root: WebLlmEvidenceElement): boolean => page.elements.some((element) => seen.has(element.target) && (element === root || tree.isUnder(element, root)));
  for (const root of page.elements) {
    const marked = webSelfChangingMarkup(root);
    if (marked === undefined || (marked === "live" && !holdsSeen(root))) continue;
    const id = attributeValue(root, "id");
    if ((pressed !== undefined && (pressed === root || tree.isUnder(pressed, root))) || (id !== undefined && controlled.has(id))) continue;
    own.add(root.target);
    for (const element of page.elements) if (tree.isUnder(element, root)) own.add(element.target);
  }
  for (const element of page.elements) if (seen.has(element.target) && !reached(element)) own.add(element.target);
}
