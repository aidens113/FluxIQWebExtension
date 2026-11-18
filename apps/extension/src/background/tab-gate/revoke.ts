// Takes a tab's content scripts out of service. This is the one message the
// gate sends without first refusing an own-page tab: it is sent precisely
// because the tab is now one FluxIQ must not touch, it carries nothing, and the
// script's answer is a bare acknowledgement. The scripts discard what they hold
// unsent and end work in flight with a page-free refusal (`content/revoked/`).

import { CONTENT_REVOKED_MESSAGE } from "../../shared/own-pages";

/**
 * Tells every frame of `tabId` that its content script is revoked. Resolves
 * true when a script acknowledged, false when none was listening (a tab with no
 * script has nothing to discard, and so is not an error). Nothing is read from
 * the tab, and its contents never reach this call.
 */
export function revokeTabContent(tabId: number): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: CONTENT_REVOKED_MESSAGE }, (response: unknown) => {
      void chrome.runtime.lastError;
      resolve(typeof response === "object" && response !== null && (response as { ok?: unknown }).ok === true);
    });
  });
}
