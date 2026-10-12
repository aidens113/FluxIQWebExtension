// Where the in-flight records live: `chrome.storage.session`, which survives a
// service-worker restart and is forgotten when the browser closes -- exactly
// the life of a command that can still be in flight. A browser without it
// (Firefox before 115) gets a memory that lives as long as the worker, which
// still answers a repeated command id but cannot report a command the worker
// lost when it stopped (`session-disconnect-memory.ts` makes the same choice).

import type { InFlightRecordArea } from "./record-store";

export function inFlightRecordArea(): InFlightRecordArea {
  const area = (globalThis as { chrome?: { storage?: { session?: chrome.storage.StorageArea } } }).chrome?.storage?.session;
  if (!area) return workerMemoryRecordArea();
  return {
    get: async (keys) => await area.get(keys),
    set: async (items) => {
      await area.set(items);
    },
    remove: async (keys) => {
      await area.remove(keys);
    }
  };
}

/** A stand-in for session storage that lives as long as this worker; tests share one across two "workers". */
export function workerMemoryRecordArea(): InFlightRecordArea {
  const items = new Map<string, unknown>();
  return {
    get: async () => Object.fromEntries(items),
    set: async (values) => {
      for (const [key, value] of Object.entries(values)) items.set(key, structuredClone(value));
    },
    remove: async (key) => {
      items.delete(key);
    }
  };
}
