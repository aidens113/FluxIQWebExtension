// The command ids this browser has received, kept in the same session storage
// as the in-flight records (plan B3, Core C8), so a restarted service worker
// still knows a command reached it after the command's record was cleared.
//
// It is what keeps the answer to Core's "what became of command X?" honest: a
// worker that lost the result it sent must answer `unknown`, never `not_seen`,
// because `not_seen` lets Core make the act again. Only ids and times are kept,
// one key per id (`fluxiq.commandSeen.<commandId>`), the newest `SEEN_LIMIT`.

import type { InFlightRecordArea } from "./record-store";

const KEY_PREFIX = "fluxiq.commandSeen.";

/** How many received command ids are remembered, newest kept. */
const SEEN_LIMIT = 64;

export class SeenCommandStore {
  constructor(private readonly area: InFlightRecordArea) {}

  /** Remembers that a command reached this browser, and forgets the oldest past the limit. */
  async mark(commandId: string, at: number): Promise<void> {
    await this.area.set({ [KEY_PREFIX + commandId]: at });
    const seen = Object.entries(await this.area.get(null))
      .filter((entry): entry is [string, number] => entry[0].startsWith(KEY_PREFIX) && typeof entry[1] === "number")
      .sort((left, right) => right[1] - left[1]);
    for (const [key] of seen.slice(SEEN_LIMIT)) await this.area.remove(key);
  }

  async has(commandId: string): Promise<boolean> {
    return typeof (await this.area.get(null))[KEY_PREFIX + commandId] === "number";
  }
}
