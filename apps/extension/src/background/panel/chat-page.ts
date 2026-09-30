// Which page the chat tells FluxIQ the person is on: the page a build starts
// from when they say "automate this".
//
// The first tab, in this order, that is a web page (`acceptedPageUrl`) and is
// not one of FluxIQ's own pages:
//
// 1. the active tab of the last-focused window;
// 2. the active tab of every other window.
//
// The last-focused window's active tab alone was t198's first version, and it
// is right for the real side panel and the real popup, which are not tabs. It
// is wrong wherever the panel is a page of its own: the Lab opens it as a tab,
// or docks it in a popup window, and a person may have FluxIQ's web panel open
// in the tab beside the page. The active tab is then the panel itself, or
// FluxIQ, and the build would start from a page that is not the one meant. So
// FluxIQ's own origins are refused as `activity/overlay-target.ts` refuses
// them for the overlay, and the other windows' active tabs are asked next.

import { acceptedPageUrl } from "./page-url";

/** A tab as the browser lists it. */
export type ChatPageTab = { readonly url?: string | undefined };

export type ChatPageDeps = {
  /** The active tab of the last-focused window, then the active tab of every window. Rejects when the browser cannot say. */
  readonly activeTabs: () => Promise<readonly ChatPageTab[]>;
  /** FluxIQ's own addresses: its web panel and API, its gateway. */
  readonly ownOrigins: () => readonly string[];
};

/** The page the person is on, or undefined when no open window shows a web page other than FluxIQ's own. */
export async function chatPageLocation(deps: ChatPageDeps): Promise<string | undefined> {
  const own = ownOrigins(deps.ownOrigins());
  for (const tab of await deps.activeTabs()) {
    const url = acceptedPageUrl(tab.url);
    if (url && !own.has(new URL(url).origin)) return url;
  }
  return undefined;
}

/** Origins of FluxIQ's addresses; a gateway's `ws:`/`wss:` address names the same host as `http:`/`https:`. */
function ownOrigins(addresses: readonly string[]): ReadonlySet<string> {
  const origins = new Set<string>();
  for (const address of addresses) {
    const url = acceptedPageUrl(address.replace(/^ws(s?):/iu, "http$1:"));
    if (url) origins.add(new URL(url).origin);
  }
  return origins;
}
