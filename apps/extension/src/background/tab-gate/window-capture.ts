// The one screenshot path. `captureVisibleTab` captures whatever tab is in
// front of the window, not a tab the caller names, so the check is on the
// window's active tab: a window showing FluxIQ's own page is never captured.

import { isOwnPageTab } from "./own-pages";
import { OwnPageRefusal } from "./refusal";

/** A PNG data URL of the window's visible tab, once that tab is known not to be FluxIQ's. */
export async function captureWindow(windowId: number): Promise<string> {
  const [front] = await chrome.tabs.query({ active: true, windowId });
  if (front === undefined) throw new Error(`Window ${windowId} has no tab in front to capture.`);
  if (isOwnPageTab(front)) throw new OwnPageRefusal(front.id);
  return await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
}
