// Where the extension keeps its offline queue: one value under `fluxiq.outbox`
// in a session-long storage area -- `chrome.storage.session`, which survives a
// service-worker restart and is forgotten when the browser closes, or worker
// memory in a browser without it (`../in-flight/record-area.ts`). Never
// `chrome.storage.local`: queued page data must not outlive the browser session
// that recorded it.
//
// Every read goes through `readSavedOutbox`, so a state of the wrong shape is
// repaired, written back, and reported by field name, never thrown from the
// send that queued behind it.

import type { ClientGatewayOutboxStore, ClientGatewayStorageArea } from "@fluxiq/client-gateway-websocket";
import { readSavedOutbox } from "../../saved-state";

const OUTBOX_KEY = "fluxiq.outbox";

export function extensionOutboxStore(
  area: ClientGatewayStorageArea,
  options: { onRepaired?: (fields: string[]) => void } = {}
): ClientGatewayOutboxStore {
  return {
    async read() {
      const reading = readSavedOutbox((await area.get(null))[OUTBOX_KEY]);
      if (reading.repaired.length > 0) {
        options.onRepaired?.(reading.repaired);
        await area.set({ [OUTBOX_KEY]: reading.value });
      }
      return reading.value;
    },
    async write(state) {
      await area.set({ [OUTBOX_KEY]: state });
    }
  };
}
