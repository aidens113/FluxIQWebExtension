// The feed's push subscription on the real extension runtime: every message
// the background broadcasts reaches this page's `chrome.runtime.onMessage`.
// The feed filters for `ACTIVITY_MESSAGES.changed` itself.

import type { ActivityPushListener } from "./activity-feed";

/** Listens to runtime messages; answers an unsubscribe. */
export function listenToRuntime(listener: ActivityPushListener): () => void {
  const handler = (message: unknown): void => listener(message);
  chrome.runtime.onMessage.addListener(handler);
  return () => chrome.runtime.onMessage.removeListener(handler);
}
