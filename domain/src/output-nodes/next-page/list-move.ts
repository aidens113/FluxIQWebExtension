// What a Next page step said of the list it moved, as Core reads it off the call's answer (`listMove`, t1013).
//
// Core's answer-first result settles a list's paging from it (`answer-first/result-feed/list-move.ts` in Core): which
// list, by the same `listKey` a read of that list carries (`../extract-list/answered.ts`: its item selector and frame,
// never a handle, a row or an address), whether it moved or ended, in this domain's own words for an end, and the page
// the pager marked, where it marked one (`page=N`, as a read's place is said). Until t1013 the move the model ran itself
// said nothing Core could tie to a list, so the result's header kept saying nothing had said whether a page follows
// (bikes run-mwug2xjw-41f62603).
//
// Only an answer that moved or ended has one: a move that failed, or whose list is not on the page, settles nothing,
// and a request that names no list (no `nextPage.item`) has no key to give.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { webAutomationNextPageAnswerValue, type WebAutomationNextPageEnd } from "../../actions/next-page";
import { webAutomationExtractionPlaceText } from "../../actions/extraction";
import { webAutomationExtractListKey } from "../extract-list";

/** What a Next page step said of its list (header). `said` is this domain's words; `place` is `page=N`. */
export type WebAutomationNextPageListMove = { listKey: string; verdict: "moved" | "ended"; said: string; place?: string };

/** Why the list has no next page, in words a person reads: always on the list's own page, since the list was there. */
const END_WORDS: Readonly<Record<WebAutomationNextPageEnd, string>> = {
  control_absent: "no control to its next page shows on the list's own page",
  control_disabled: "its control to the next page is disabled on the list's own page",
  no_following_page: "its pager shows no page after this one",
  scrolled_to_end: "scrolling to its end on its own page loaded no more of it"
};

/** The move a Next page step run with `parameters` (resolved) answered in `payload`, or `undefined` where it says none. */
export function webAutomationNextPageListMove(parameters: JsonObject, payload: JsonValue | undefined): WebAutomationNextPageListMove | undefined {
  const request = parameters.nextPage;
  const item = typeof request === "object" && request !== null && !Array.isArray(request) ? request.item : undefined;
  if (typeof item !== "string" || item.trim() === "") return undefined;
  const answer = typeof payload === "object" && payload !== null && !Array.isArray(payload) ? webAutomationNextPageAnswerValue(payload.nextPage) : undefined;
  if (answer === undefined || answer.outcome === "failed") return undefined;
  const frameId = parameters.browserFrameId;
  const frameUrlPath = parameters.browserFrameUrlPath;
  const listKey = webAutomationExtractListKey({ item, ...(typeof frameId === "number" ? { frameId } : {}), ...(typeof frameUrlPath === "string" ? { frameUrlPath } : {}) });
  const place = answer.page === undefined ? undefined : webAutomationExtractionPlaceText({ kind: "page", value: answer.page });
  const said = answer.outcome === "ended" ? END_WORDS[answer.stop] : place === undefined ? "the list moved to its next page" : `the list moved to ${place}`;
  return { listKey, verdict: answer.outcome, said, ...(place === undefined ? {} : { place }) };
}
