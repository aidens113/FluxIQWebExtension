// Where the in-flight records, the ids received and the host leases live:
// `chrome.storage.session`, which survives a service-worker restart and is
// forgotten when the browser closes -- exactly the life of a command that can
// still be in flight. A browser without it (Firefox before 115) gets Core's
// memory area, which lives as long as the worker: it still answers a repeated
// command id but cannot report a command the worker lost when it stopped
// (`session-disconnect-memory.ts` makes the same choice).

import { clientGatewayMemoryArea, type ClientGatewayStorageArea } from "@fluxiq/client-gateway-websocket";

export function inFlightRecordArea(): ClientGatewayStorageArea {
  const area = (globalThis as { chrome?: { storage?: { session?: chrome.storage.StorageArea } } }).chrome?.storage?.session;
  if (!area) return clientGatewayMemoryArea();
  return {
    get: async (keys) => await area.get(keys),
    set: async (items) => {
      await area.set(items);
    },
    remove: async (key) => {
      await area.remove(key);
    }
  };
}
