// The request half of `web.dom.next_page` (contract C1): which list to move on,
// and the way to its next page. One step moves one page, so the request carries
// no bound -- no `maxPages`, no `maxScrolls` -- and a Flow that wants every page
// loops over the step instead of asking it to read several.
//
// The four ways are `web.dom.extract_list`'s pagination modes without their
// bounds (`../extraction/request.ts`): `next` (also what an absent `mode`
// means) presses a Next control, `loadMore` presses a control that appends
// items, `scroll` scrolls until the list grows, and `numbered` presses the page
// control after the current one. Absent, the page finds the way live from the
// list.
//
// `WebAutomationElementFingerprint` is imported type-only from `../types`,
// which re-exports this module, as `../extraction/request.ts` does.

import type { WebAutomationElementFingerprint } from "../types";

/** How the list reaches its next page, as detected or named. */
export type WebAutomationNextPageWay =
  | { mode?: "next" | undefined; next: string }
  | { mode: "loadMore"; control: string }
  | { mode: "scroll" }
  | { mode: "numbered"; pages: string };

/** `web.dom.next_page`'s request: the list's item selector, the element it was picked from, and the way. */
export type WebAutomationNextPageRequest = {
  /** The list's item selector, which the page watches to tell that the list moved. */
  item: string;
  itemElement?: WebAutomationElementFingerprint | undefined;
  /** As detected or named; absent, found live from the list. */
  pagination?: WebAutomationNextPageWay | undefined;
};
