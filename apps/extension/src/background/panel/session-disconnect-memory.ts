// The browser's session storage as the auto-connect Disconnect memory
// (`auto-connect.ts` says why it is session storage). A browser without
// `chrome.storage.session` -- Firefox before 115 -- falls back to a memory that
// lives as long as the worker.

import { STORAGE_KEYS } from "../../shared/constants";
import { workerDisconnectMemory, type DisconnectMemory } from "./auto-connect";

export function sessionDisconnectMemory(): DisconnectMemory {
  const area = (globalThis as { chrome?: { storage?: { session?: chrome.storage.StorageArea } } }).chrome?.storage?.session;
  if (!area) return workerDisconnectMemory();
  const key = STORAGE_KEYS.disconnectedByPerson;
  return {
    read: async () => (await area.get(key))[key] === true,
    write: async (disconnectedByPerson) => {
      await area.set({ [key]: disconnectedByPerson });
    }
  };
}
