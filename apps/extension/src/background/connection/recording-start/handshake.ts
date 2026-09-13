// The recording-start handshake with FluxIQ: one pending start at a time, each
// attempt given its own acceptance window, and a bounded retry for the one
// refusal that waiting can fix.
//
// Three outcomes are possible for an attempt, and each has exactly one answer:
//
//   accepted   FluxIQ sends `server.start_recording`; the handshake is over.
//   unanswered nothing comes back inside the acceptance window, so recording
//              begins locally and no user action is lost. This is the original
//              fallback and it is unchanged.
//   refused    FluxIQ answered. The window is over the moment it does -- a
//              refusal is an answer, not silence -- so the acceptance timer is
//              cancelled and `refusal.kind` decides what happens next.
//
// A persistent refusal ends the handshake immediately and is surfaced. A
// transient one is re-sent after a short delay, at most `retryDelaysMs.length`
// times; the delays give whatever went stale a chance to be stamped again, and
// each retry gets a fresh acceptance window of its own. When the last delay is
// spent the refusal is surfaced exactly as a persistent one would be, carrying
// the attempt count. That bound is the point: a recorder that retries forever
// and tells nobody is worse than one that latches idle, because the latched one
// is at least visible.

import type { JsonObject } from "../../../shared/protocol";
import type { RecordingStartRefusal } from "./refusal";

// How long one attempt waits for FluxIQ to answer before recording locally.
export const RECORDING_START_ACCEPT_TIMEOUT_MS = 750;

// Delays before each retry of a transient refusal, in order. Length is the
// retry bound; the total, ~4s, is short enough that a user who pressed Record
// is still watching and long enough to outlast a context restamp.
export const RECORDING_START_RETRY_DELAYS_MS: readonly number[] = [400, 1_200, 2_400];

export type RecordingStartAttempt = {
  readonly recordingId: string;
  readonly startedAt: number;
  readonly initialState: JsonObject;
  // 0 for the first send, then 1, 2, ... for each retry.
  readonly attempt: number;
};

export type RecordingStartHandshakeDeps = {
  // Sends one attempt. Called synchronously so a caller can observe the send
  // in the same turn the timer fires.
  readonly send: (attempt: RecordingStartAttempt) => Promise<void>;
  // No answer inside the acceptance window.
  readonly beginLocally: (recordingId: string) => Promise<void>;
  // A refusal the handshake has stopped fighting: persistent, exhausted, or
  // arriving with no start of ours in flight. `attempts` counts sends made.
  readonly surfaceRefusal: (refusal: RecordingStartRefusal, attempts: number) => void;
  // A transient refusal that will be retried. `attempt` is 1-based over the
  // retry bound, so it reads as "1 of 3".
  readonly noteRetry: (refusal: RecordingStartRefusal, attempt: number, of: number, delayMs: number) => void;
  readonly acceptTimeoutMs?: number | undefined;
  readonly retryDelaysMs?: readonly number[] | undefined;
};

type PendingStart = {
  readonly recordingId: string;
  readonly startedAt: number;
  readonly initialState: JsonObject;
  attempt: number;
  acceptTimer: ReturnType<typeof setTimeout> | undefined;
  retryTimer: ReturnType<typeof setTimeout> | undefined;
};

export class RecordingStartHandshake {
  private pending: PendingStart | undefined;

  constructor(private readonly deps: RecordingStartHandshakeDeps) {}

  isPending(): boolean {
    return this.pending !== undefined;
  }

  pendingRecordingId(): string | undefined {
    return this.pending?.recordingId;
  }

  // Sends the first attempt and opens its acceptance window.
  async begin(input: { recordingId: string; startedAt: number; initialState: JsonObject }): Promise<void> {
    this.cancel();
    this.pending = { ...input, attempt: 0, acceptTimer: undefined, retryTimer: undefined };
    await this.sendPending(this.pending);
  }

  // FluxIQ accepted, or recording started some other way. Nothing is in flight.
  noteAccepted(): void {
    this.cancel();
  }

  cancel(): void {
    if (!this.pending) return;
    if (this.pending.acceptTimer !== undefined) clearTimeout(this.pending.acceptTimer);
    if (this.pending.retryTimer !== undefined) clearTimeout(this.pending.retryTimer);
    this.pending = undefined;
  }

  noteRefusal(refusal: RecordingStartRefusal): void {
    const pending = this.pending;
    // A refusal with nothing of ours in flight -- a start the web panel asked
    // for, or one already resolved. There is nothing to retry, and the user
    // still needs to be told.
    if (!pending) {
      this.deps.surfaceRefusal(refusal, 0);
      return;
    }
    if (pending.acceptTimer !== undefined) {
      clearTimeout(pending.acceptTimer);
      pending.acceptTimer = undefined;
    }
    const attempts = pending.attempt + 1;
    const delays = this.deps.retryDelaysMs ?? RECORDING_START_RETRY_DELAYS_MS;
    const delayMs = refusal.kind === "transient" ? delays[pending.attempt] : undefined;
    if (delayMs === undefined) {
      this.cancel();
      this.deps.surfaceRefusal(refusal, attempts);
      return;
    }
    this.deps.noteRetry(refusal, attempts, delays.length, delayMs);
    pending.retryTimer = setTimeout(() => this.resend(pending.recordingId), delayMs);
  }

  private resend(recordingId: string): void {
    const pending = this.pending;
    if (!pending || pending.recordingId !== recordingId) return;
    pending.retryTimer = undefined;
    pending.attempt += 1;
    void this.sendPending(pending);
  }

  // The acceptance window is armed before the send rather than after it: it
  // measures how long the user has been waiting, and a send that never
  // resolves is exactly the silence the local fallback exists for.
  private async sendPending(pending: PendingStart): Promise<void> {
    pending.acceptTimer = setTimeout(
      () => this.acceptWindowElapsed(pending.recordingId),
      this.deps.acceptTimeoutMs ?? RECORDING_START_ACCEPT_TIMEOUT_MS
    );
    await this.deps.send({
      recordingId: pending.recordingId,
      startedAt: pending.startedAt,
      initialState: pending.initialState,
      attempt: pending.attempt
    });
  }

  private acceptWindowElapsed(recordingId: string): void {
    const pending = this.pending;
    if (!pending || pending.recordingId !== recordingId) return;
    pending.acceptTimer = undefined;
    this.cancel();
    void this.deps.beginLocally(recordingId);
  }
}
