// Every message the extension sends into a page goes through here: actions,
// looks, fact checks, extraction, recording on and off, the activity overlay,
// trace captures and the content script's own ping. A tab showing FluxIQ's own
// page is refused before the message leaves.

import { isOwnPageRefusalReply } from "../../shared/own-pages";
import { refuseOwnPageTab } from "./guard";
import { OwnPageRefusal } from "./refusal";

/**
 * Sends `message` to the tab (its every frame, or `frameId` alone) once the tab
 * is known not to be FluxIQ's; rejects as the browser words a failed send.
 *
 * The receiving document decides again, by its own origin, before it reads or
 * does anything (`content/own-document/`): that covers a tab that moved to a
 * FluxIQ page after the check above, and a FluxIQ page framed inside an
 * ordinary tab. Its refusal arrives as a reply and is thrown as the same
 * `OwnPageRefusal`.
 */
export async function sendTabMessage<TResponse = unknown>(tabId: number, message: unknown, frameId?: number): Promise<TResponse> {
  await refuseOwnPageTab(tabId);
  return await new Promise((resolve, reject) => {
    const callback = (response: unknown) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else if (isOwnPageRefusalReply(response)) reject(response.refused === "own_page" ? new OwnPageRefusal(tabId) : new Error(response.error));
      else resolve(response as TResponse);
    };
    if (frameId !== undefined) chrome.tabs.sendMessage(tabId, message, { frameId }, callback);
    else chrome.tabs.sendMessage(tabId, message, callback);
  });
}
