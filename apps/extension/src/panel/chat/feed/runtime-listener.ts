// The feed's push subscription on the real extension runtime: every message
// the background broadcasts reaches this page's `chrome.runtime.onMessage`.
// The transport's activity port filters for `ACTIVITY_MESSAGES.changed`.

import type { RuntimeListen } from "../transport/ports";

/** Listens to runtime messages; answers an unsubscribe. */
export const listenToRuntime: RuntimeListen = (listener) => {
  const handler = (message: unknown): void => listener(message);
  chrome.runtime.onMessage.addListener(handler);
  return () => chrome.runtime.onMessage.removeListener(handler);
};
