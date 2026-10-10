// The record the background keeps of every action it has sent toward a page
// and not yet answered (plan B3), in the browser's session storage so it
// outlives the service worker that wrote it.
//
// One key per command (`fluxiq.inFlight.<commandId>`) rather than one map
// under one key: writing and clearing two commands' records never reads and
// rewrites the other's, so neither can undo the other. The records name a
// command, its action type, whether it commits, when it started and which tab
// and document it was sent to -- never a value it carries or a page address.

import type { WebAutomationInFlightCommand } from "@fluxiq-web-extension/domain/client";

/** What is kept while a command is in flight: the result's fields, and where it was sent. */
export type InFlightCommandRecord = WebAutomationInFlightCommand & {
  tabId?: number;
  documentId?: string;
};

/** The storage the records live in: the browser's session storage, or a stand-in for it (`./record-area.ts`). */
export type InFlightRecordArea = {
  get(keys: null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string): Promise<void>;
};

const KEY_PREFIX = "fluxiq.inFlight.";

export class InFlightRecordStore {
  constructor(private readonly area: InFlightRecordArea) {}

  async write(record: InFlightCommandRecord): Promise<void> {
    await this.area.set({ [KEY_PREFIX + record.commandId]: record });
  }

  async read(commandId: string): Promise<InFlightCommandRecord | undefined> {
    const value = (await this.area.get(null))[KEY_PREFIX + commandId];
    return isRecord(value) ? value : undefined;
  }

  async remove(commandId: string): Promise<void> {
    await this.area.remove(KEY_PREFIX + commandId);
  }

  /** Every record in storage, oldest first. A value under the prefix that is not a record is left where it is. */
  async all(): Promise<InFlightCommandRecord[]> {
    const items = await this.area.get(null);
    return Object.entries(items)
      .filter(([key]) => key.startsWith(KEY_PREFIX))
      .map(([, value]) => value)
      .filter(isRecord)
      .sort((left, right) => left.startedAt - right.startedAt);
  }
}

/** Read field by field: session storage is this extension's, but a record from an older build may lack a field. */
function isRecord(value: unknown): value is InFlightCommandRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.commandId === "string" && typeof record.actionType === "string" && typeof record.committing === "boolean" && typeof record.startedAt === "number";
}
