// The digests this worker has stored, one record per Core and trace scope
// (`metadata.trace.scope`, the trace a command is recorded into). Each trace
// must hold every artifact its results reference, so a digest stored for one
// scope is not stored for another; a command with no scope uses its Core's
// unscoped record, as before scopes existed.
//
// Bounded: past `limit` records the least recently used one is dropped, and a
// later command in it uploads its digests again. A worker that restarts
// remembers nothing and uploads again; Core keeps one copy.

export class StoredDigests {
  /** Insertion order is use order: a record used is moved to the end. */
  private readonly records = new Map<string, Set<string>>();

  constructor(private readonly limit: number) {}

  /** The record for one Core and scope, marked most recently used and created when missing. */
  record(coreApiUrl: string, scope: string | undefined): Set<string> {
    const key = JSON.stringify([coreApiUrl, scope ?? null]);
    const record = this.records.get(key) ?? new Set<string>();
    this.records.delete(key);
    this.records.set(key, record);
    while (this.records.size > Math.max(1, this.limit)) {
      const oldest = this.records.keys().next().value as string;
      this.records.delete(oldest);
    }
    return record;
  }
}
