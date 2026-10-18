// What a state diff says of a step's places (t609, for FluxIQ Core t598):
//
// - `spot`: `{ item?, dialog?, subject?, page? }`, the opaque tokens of the
//   item and dialog the step's control sat in on the page before it, and of
//   what it and that page are about (Core t719) -- `webTargetSpot` of the
//   element the node's selector addresses there. Absent when the node names no
//   selector, the page before held no such element, or it gave none of them.
// - `items`: `{ before, after }`, the tokens of the items of the lists the diff
//   vouches for, on each page. Core counts an item the step created when it is
//   in `after` and not in `before` (`service/candidate-trial/landed-acts.ts`).
//
// **Only lists present on both pages (user rule: a reset undoes only the
// build's own lasting acts and never touches what existed before the build).**
// A list counts only when the page before showed the same list -- the same
// container, the same shape down to its items (`./snapshot.ts`) -- with at
// least one item, and every item it showed is still in it. Then its new items
// are the step's. Everything else is left out of both sides, so Core can count
// none of it created:
//
// - a list the step only revealed -- a mini-cart drawer opening on the same
//   document over lines that were there before the build -- was not on the
//   page before, so none of its lines is a new one;
// - a list that lost or changed an item at the same time -- a line whose words
//   changed with its quantity reads as another item, since an unkeyed item is
//   named by its words -- cannot say which of its items is new;
// - a list whose single line the page before named by nothing (an unkeyed item
//   is named only where it is one of several, `content/identity/record.ts`)
//   showed no item, so that line gaining a name beside a new one is not two new
//   lines.
//
// The other rule t598 weighed, a per-line token Core would filter against every
// item the build had ever seen, is not taken: a trial that re-adds the item
// exploration added and then undid must still be credited with it, and the
// item's token is the same both times, so any build-wide filter would strip
// it. Vouching per step needs no memory across steps: a re-add to a list on
// the page is a new item of that list, whatever an earlier step did.
//
// A step that moved to another document vouches for no list: the two pages are
// not one page before and after, and Core credits nothing there anyway. More
// items than Core reads (2,000) are no list it can use, and none is written.

import type { JsonObject } from "fluxiq/core";
import { webTargetSpot } from "../../llm-evidence";
import { webResetCollections } from "../../llm-evidence/control-spot";
import { webNodeTargetPlaceKey } from "./node-target";
import type { WebStateSnapshotPlaces } from "./snapshot";

/** Core's bound on a page's items (`landed-acts.ts`, `MAX_ITEMS`). */
const MAX_ITEMS = 2_000;

/** The `spot` and `items` keys of a step's diff, from the places of its two pages; each absent where they say nothing (header). */
export function webStateDiffPlaces(
  before: WebStateSnapshotPlaces | undefined,
  after: WebStateSnapshotPlaces | undefined,
  node: { definitionId: string; parameterValues?: JsonObject | undefined },
  documentChanged: boolean
): JsonObject {
  const spot = before ? spotOf(before, node) : undefined;
  const items = before && after && !documentChanged ? vouched(before, after) : undefined;
  const was = before && !documentChanged ? webResetCollections(before).collections : [];
  const now = after && !documentChanged ? webResetCollections(after).collections : [];
  const groups = new Set(was.map((collection) => collection.group));
  const collections = was.length && now.length && now.every((collection) => groups.has(collection.group))
    ? { before: was, after: now } : undefined;
  return { ...(spot ? { spot } : {}), ...(items ? { items } : {}), ...(collections ? { collections } : {}) };
}

function spotOf(before: WebStateSnapshotPlaces, node: { definitionId: string; parameterValues?: JsonObject | undefined }): JsonObject | undefined {
  const key = webNodeTargetPlaceKey(node);
  const handle = key === undefined ? undefined : before.handles.get(key);
  if (handle === undefined) return undefined;
  const spot = webTargetSpot(before, handle);
  return Object.keys(spot).length > 0 ? spot : undefined;
}

/** The items of every list both pages show, on each side; none when no list is (header). */
function vouched(before: WebStateSnapshotPlaces, after: WebStateSnapshotPlaces): { before: string[]; after: string[] } | undefined {
  const was = new Set<string>();
  const now = new Set<string>();
  for (const [list, items] of after.lists) {
    const earlier = before.lists.get(list);
    if (!earlier?.length) continue;
    const kept = new Set(items);
    if (!earlier.every((item) => kept.has(item))) continue;
    for (const item of earlier) was.add(item);
    for (const item of items) now.add(item);
  }
  if (now.size === 0 || was.size > MAX_ITEMS || now.size > MAX_ITEMS) return undefined;
  return { before: [...was], after: [...now] };
}
