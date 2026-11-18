// Where the ended pairing is kept between worker restarts: a Manifest V3 worker
// stops after half a minute idle, and a revoked browser must still read as
// revoked when the panel opens later. `chrome.storage.local`, beside the
// session record, never session storage: a browser restart must not forget it.

import type { ExtensionPairingEnded } from "../../../shared/protocol";

export type PairingEndedStorage = {
  /** What an earlier worker kept, or undefined for nothing or for a value of the wrong shape. */
  read(): Promise<ExtensionPairingEnded | undefined>;
  /** Keeps `ended`, or removes what was kept when it is undefined. */
  write(ended: ExtensionPairingEnded | undefined): Promise<void>;
};

const PAIRING_ENDED_KEY = "fluxiq.pairingEnded";
const STATES: ReadonlySet<unknown> = new Set(["revoked", "expired", "refused"]);

/** The browser's local storage, reached per call, never at construction. */
export function chromePairingEndedStorage(): PairingEndedStorage {
  return {
    read: async () => readPairingEnded((await chrome.storage.local.get(PAIRING_ENDED_KEY))[PAIRING_ENDED_KEY]),
    write: async (ended) => {
      if (ended === undefined) await chrome.storage.local.remove(PAIRING_ENDED_KEY);
      else await chrome.storage.local.set({ [PAIRING_ENDED_KEY]: ended });
    }
  };
}

/** A stored value as an ended pairing, or undefined when it is not one. */
export function readPairingEnded(stored: unknown): ExtensionPairingEnded | undefined {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return undefined;
  const value = stored as Record<string, unknown>;
  if (!STATES.has(value.state) || typeof value.at !== "number" || !Number.isFinite(value.at)) return undefined;
  const ended: ExtensionPairingEnded = { state: value.state as ExtensionPairingEnded["state"], at: value.at };
  if (typeof value.reason === "string" && value.reason) ended.reason = value.reason;
  return ended;
}
