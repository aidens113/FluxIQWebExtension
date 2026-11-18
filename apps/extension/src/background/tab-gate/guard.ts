// The tab check every gated call makes first. It reads the tab -- a read the
// gate needs and nothing else -- and refuses before any message, script,
// capture or act reaches it.
//
// The check is on the tab's top document, the one the browser reports: a
// frame is refused or admitted with its tab. The browser may move the tab
// between this read and the call that follows; that window is the browser's
// own message hop, and is stated in the gate's report rather than hidden.

import { isOwnPageTab } from "./own-pages";
import { OwnPageRefusal } from "./refusal";

/**
 * Throws `OwnPageRefusal` when `tabId` shows, or is loading, one of FluxIQ's
 * own pages. A tab the browser cannot read rejects as the browser words it
 * ("No tab with id"), which is what the call it guards would have said.
 */
export async function refuseOwnPageTab(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  if (tab && isOwnPageTab(tab)) throw new OwnPageRefusal(tabId);
}

/**
 * The refusal for `tabId`, or undefined when it is not one of FluxIQ's pages
 * or cannot be read. For a caller that turns the refusal into its own failure
 * record before doing anything; a tab it cannot read is left to the gated call
 * that follows, which fails as the browser says.
 */
export async function ownPageRefusalFor(tabId: number): Promise<OwnPageRefusal | undefined> {
  try {
    await refuseOwnPageTab(tabId);
    return undefined;
  } catch (error) {
    return error instanceof OwnPageRefusal ? error : undefined;
  }
}
