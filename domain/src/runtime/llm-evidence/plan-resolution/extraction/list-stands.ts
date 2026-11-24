// Whether a saved read's list stands on the page it just read, or the read
// took the rows of whatever another page's elements its item selector matched
// (t1022).
//
// A read named by a handle carries what the handle stood for, the list's item
// selector and the page it was detected on (`./saved-list.ts`), and is
// resolved to that selector alone: nothing checked that the page the read runs
// on is the list's. A selector a site's template shares between pages -- a
// shelf of cards drawn on the home page and again as "Frequently bought
// together" on the cart -- then reads the other page's cards as rows of the
// list, and neither the model nor the judge can tell which list they came from.
// The binding's location was compared only with a location the call wrote
// (`./slot.ts`), never with the page.
//
// **A list stands where it was made, or where its own pager took it.** The
// read's page is in the list's family when the two addresses share their origin
// and their path's shape (`./list-family.ts`); a page its own Next page step
// moved it to in this build stands too, whatever its address, since the
// pager's answer said the list moved there (`movedByPager`). Anywhere else the
// read's rows are not this list's, whatever its selector matched, and the read
// is refused naming the list and the page it was made on. A list that is not
// on its own page at all is the read's own account (`list_never_appeared`) and
// is left to it.
//
// Typed facts only: two addresses, the binding's item selector, and the pager's
// closed verdict. No word of the page is read.

import type { JsonObject } from "fluxiq/core";
import { isJsonRecord } from "../../untrusted-json";
import { webPlanHandleKind } from "../handle-tokens";
import { webPlanListPageFamily } from "./list-family";
import { webPlanSavedExtractionBinding } from "./saved-list";

/** A read whose list is not on the page it read: the list's handle, where it was detected, and where the read ran. */
export type WebPlanListReadElsewhere = { handle: string; madeAt: string; readAt: string };

/**
 * The list `parameters` read (a step's own, holding its binding) when it does not stand on the page at `readAt`;
 * `undefined` when it stands, or when the read names no saved list or either address names no page (header).
 */
export function webPlanListReadElsewhere(parameters: JsonObject, readAt: string | undefined, movedByPager: (item: string) => boolean): WebPlanListReadElsewhere | undefined {
  const list = parameters.extractList;
  if (!isJsonRecord(list) || readAt === undefined) return undefined;
  const handle = listHandle(list);
  const binding = handle === undefined ? undefined : webPlanSavedExtractionBinding(list, handle);
  if (handle === undefined || !binding) return undefined;
  const made = webPlanListPageFamily(binding.location);
  const read = webPlanListPageFamily(readAt);
  if (made === undefined || read === undefined || made === read) return undefined;
  if (movedByPager(binding.extractList.item)) return undefined;
  return { handle, madeAt: binding.location, readAt };
}

/** The extraction handle the read names its list by: its own, or its item's. */
function listHandle(list: Record<string, unknown>): string | undefined {
  const named = typeof list.handle === "string" ? list.handle : isJsonRecord(list.item) && typeof list.item.handle === "string" ? list.item.handle : undefined;
  return named !== undefined && webPlanHandleKind(named) === "extraction" ? named : undefined;
}
