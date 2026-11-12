import type { FluxIQSession } from "../../../shared/protocol";

/** Serializes durable writes while callers continue to adopt session state synchronously. */
export class SessionWrites {
  private pending: Promise<void> = Promise.resolve();

  constructor(private readonly current: () => FluxIQSession, private readonly write: (session: FluxIQSession) => Promise<void>) {}

  save(): Promise<void> {
    // Read when the write starts. A queued snapshot must never restore an
    // older project or credential over state the connection has since adopted.
    const write = (): Promise<void> => this.write(this.current());
    const pending = this.pending.then(write, write);
    this.pending = pending;
    return pending;
  }
}
