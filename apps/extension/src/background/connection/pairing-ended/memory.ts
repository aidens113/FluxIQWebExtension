// How this browser's approval ended, while it waits for the person to pair it
// again: what the status reports as `pairingEnded` (`ExtensionPairingEnded`).
// Held in memory for the status, which is read synchronously, and written
// through to storage so a restarted worker still knows.

import type { ExtensionPairingEnded } from "../../../shared/protocol";
import type { PairingEndedStorage } from "./storage";

export class PairingEndedMemory {
  private value: ExtensionPairingEnded | undefined;
  // A note or clear made in this worker is newer than anything storage held.
  private decidedHere = false;

  constructor(private readonly storage: PairingEndedStorage) {}

  current(): ExtensionPairingEnded | undefined {
    return this.value;
  }

  /** Reads what an earlier worker kept, unless this one already decided; true when that changed `current`. */
  async load(): Promise<boolean> {
    const stored = await this.storage.read();
    if (this.decidedHere || stored === undefined) return false;
    this.value = stored;
    return true;
  }

  note(ended: ExtensionPairingEnded): Promise<void> {
    this.decidedHere = true;
    this.value = ended;
    return this.storage.write(ended);
  }

  /** The person asked to pair again, or a session is ready: nothing ended any more. */
  clear(): Promise<void> {
    this.decidedHere = true;
    this.value = undefined;
    return this.storage.write(undefined);
  }
}
