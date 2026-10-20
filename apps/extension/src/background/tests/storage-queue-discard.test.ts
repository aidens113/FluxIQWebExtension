// The offline queue no longer lives in `chrome.storage.local`, where queued page
// data outlived the browser session that recorded it. Whatever an older build
// left there is removed when the background starts, and nothing else is.

import assert from "node:assert/strict";
import test from "node:test";
import { STORAGE_KEYS } from "../../shared/constants";
import { discardPersistentQueue } from "../storage";

test("the persistent queue an older build left is removed, and the rest of local storage is kept", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  const stored: Record<string, unknown> = {
    [STORAGE_KEYS.queuedEvents]: [{ type: "client.recording_event", payload: {} }],
    [STORAGE_KEYS.clientId]: "extension-1"
  };
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { storage: { local: {
    remove: async (key: string) => {
      delete stored[key];
    }
  } } } });
  try {
    await discardPersistentQueue();
    assert.deepEqual(Object.keys(stored), [STORAGE_KEYS.clientId]);
    // Nothing left to remove is not a failure.
    await discardPersistentQueue();
    assert.deepEqual(Object.keys(stored), [STORAGE_KEYS.clientId]);
  } finally {
    if (previous) Object.defineProperty(globalThis, "chrome", previous); else Reflect.deleteProperty(globalThis, "chrome");
  }
});
