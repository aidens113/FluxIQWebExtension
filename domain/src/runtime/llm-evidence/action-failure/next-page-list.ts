// A Next page refused because its list is not on the page names that list (t1013).
//
// The refusal's reason, `list_not_on_page`, is read off the page's closed answer (`./refusal.ts`); the page cannot know
// which handle the model wrote for the list, only its item selector, which the model is never shown. So the list is
// named here, from the call as the model wrote it: `nextPage` as `extraction.N`, `{list: "extraction.N", control?}`,
// either with `{handle, location?}` in place of the token, or `{handle}` alone (`../plan-resolution/next-page-slot.ts`).
// Its `next` then says which list to go back to. A call written with no list handle -- the literal request -- is told
// the same reason without a name.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { rejectionDetail } from "../tool-rejection";
import type { WebActionRefusal } from "./refusal";

/** `refused` naming the list its call's `nextPage` wrote, where it is a list that is not on the page. */
export function webNextPageListNamed(refused: WebActionRefusal, written: JsonObject): WebActionRefusal {
  if (refused.detail?.reason !== "list_not_on_page") return refused;
  const handle = listHandle(written.nextPage);
  if (handle === undefined) return refused;
  return { ...refused, detail: rejectionDetail({ reason: "list_not_on_page", target: handle, instead: undefined, missing: undefined, requestId: undefined }) };
}

/** The list handle `nextPage` was written with: bare, `{handle}`, or as its `list`. */
function listHandle(value: JsonValue | undefined): string | undefined {
  if (typeof value === "string") return handleText(value);
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  if (value.list !== undefined) return listHandle(value.list);
  return typeof value.handle === "string" ? handleText(value.handle) : undefined;
}

/** An extraction handle as written (`extraction.3`), and nothing else: never a selector or page words. */
function handleText(value: string): string | undefined {
  return /^extraction\.\d{1,6}$/u.test(value.trim()) ? value.trim() : undefined;
}
