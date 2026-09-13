import { RunnerFailure } from "../failure.js";
import type { FluxIQHttpOptions } from "../http-control.js";

/**
 * Waiting for Core to finish writing a recording, before anything reads it.
 *
 * The extension's `stopRecording` returns as soon as the *client* has stopped.
 * Core keeps working after that: its client-gateway bridge drains in-flight
 * events (`stopDrainMs`, 250 ms by default), flushes the queued entries, and
 * only then calls `finalizeRecording`, which stamps `endedAt` under the
 * recording mutation lock. Appends that arrive afterwards are refused
 * ("Finalized recordings are immutable."). So `endedAt` is Core's own
 * completion signal: while it is absent the timeline can still grow, and once
 * it is present the timeline can no longer change.
 *
 * That matters because a proposal built from a half-written recording is
 * silently short. `L-dropped-action` measured Core appending action entries
 * for 2.4 s (5 s in one run) after the extension had stopped, while the Flow
 * lane asked for a proposal about one second after the stop; the candidate
 * count in every failing run equalled the number of entries Core had appended
 * by that instant, and nothing reported the loss.
 *
 * This waits on the signal, not on a clock. A fixed delay tuned to the
 * observed 2.4 s would be the same bug with a longer fuse — too short on a
 * slower machine, wasted time on a faster one. The appended-entry count is
 * still read on every poll, for two reasons: it must repeat across a
 * confirming read before the recording is accepted, so an entry landing after
 * `endedAt` (which Core's immutability rule says cannot happen) is picked up
 * rather than proposed past; and the counts travel into the failure and the
 * run bundle, so the next occurrence explains itself. One confirming read is
 * the right weight for that check and no more: the count is a contradiction
 * detector, not the definition of completion -- a still-open timeline that
 * happened to pause for one interval would read as stable, which is exactly
 * why `endedAt`, and not the count, is the rule.
 *
 * The bound fails. Proposing from a partial recording is precisely the defect,
 * so a wait that gives up and proceeds would have reimplemented it.
 */

/** The single Core call this makes; `ExistingFluxIQControlClient` satisfies it. */
export type FinalizedRecordingControl = {
  automationStudioCall(endpoint: string, payload: Record<string, unknown>, bounds?: FluxIQHttpOptions, domainId?: string): Promise<unknown>;
};

/** What Core reported once it had finished the recording. */
export type FinalizedRecording = {
  recordingId: string;
  /** Core's completion signal, stamped by `finalizeRecording`. */
  endedAt: number;
  /** Timeline entries the finished recording holds. */
  entryCount: number;
  waitedMs: number;
  polls: number;
  /**
   * Entries Core appended between this wait's first poll and its last. Not a
   * count from Stop: the first poll follows `stopRecording`'s return and
   * whatever the caller read before waiting, so entries appended before it are
   * already in the first count. A second wait on a finished recording reads 0.
   */
  entriesAppendedWhileWaiting: number;
};

/** Bounds and the injected clock the tests drive; production passes none. */
export type FinalizedRecordingWait = {
  timeoutMs?: number;
  intervalMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
};

// Two concurrent Stage 3 benches measured a healthy 26-entry recording at
// 25,789 ms and projected 49-56 s at the observed p90 per-entry rate. Ninety
// seconds leaves useful headroom for that loaded path without handing an
// unfinished recording downstream.
const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_INTERVAL_MS = 200;

type RecordingObservation = { seen: boolean; endedAt?: number; entryCount: number };

/**
 * Polls Core until the recording reports `endedAt` and its appended-entry
 * count repeats, then returns what it observed. Throws
 * `recording.persistence` at the bound: an unfinished recording is never
 * handed on.
 */
export async function awaitFinalizedRecording(
  control: FinalizedRecordingControl,
  input: { projectId: string; recordingId: string },
  bounds: FluxIQHttpOptions = {},
  wait: FinalizedRecordingWait = {},
): Promise<FinalizedRecording> {
  const now = wait.now ?? (() => Date.now());
  const sleep = wait.sleep ?? ((ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); }));
  const timeoutMs = wait.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const intervalMs = wait.intervalMs ?? DEFAULT_INTERVAL_MS;
  const startedAt = now();
  const deadline = startedAt + timeoutMs;
  let polls = 0;
  let firstEntryCount: number | undefined;
  let observed: RecordingObservation | undefined;
  let finished: RecordingObservation | undefined;
  let finishedReads = 0;
  for (;;) {
    observed = await readRecording(control, input, bounds);
    polls += 1;
    if (firstEntryCount === undefined) firstEntryCount = observed.entryCount;
    if (observed.endedAt !== undefined) {
      finishedReads += 1;
      // Two consecutive finished reads at the same count: the signal says the
      // timeline is frozen and the count agrees. Either alone would accept a
      // recording the other says is still moving.
      if (finished && finished.entryCount === observed.entryCount) {
        return {
          recordingId: input.recordingId,
          endedAt: observed.endedAt,
          entryCount: observed.entryCount,
          waitedMs: now() - startedAt,
          polls,
          entriesAppendedWhileWaiting: observed.entryCount - firstEntryCount,
        };
      }
      finished = observed;
    }
    if (now() >= deadline) break;
    await sleep(intervalMs);
  }
  throw new RunnerFailure("recording.persistence", timeoutMessage(observed, finishedReads, timeoutMs), {
    details: {
      recordingId: input.recordingId,
      recordingSeen: observed?.seen ?? false,
      endedAt: observed?.endedAt ?? null,
      entryCount: observed?.entryCount ?? null,
      entriesAppendedWhileWaiting: observed && firstEntryCount !== undefined ? observed.entryCount - firstEntryCount : null,
      waitedMs: now() - startedAt,
      polls,
      timeoutMs,
    },
  });
}

function timeoutMessage(observed: RecordingObservation | undefined, finishedReads: number, timeoutMs: number): string {
  if (!observed?.seen) return `Core did not report the run's recording within ${timeoutMs} ms, so nothing downstream may read it`;
  if (observed.endedAt === undefined) return `Core was still writing the run's recording after ${timeoutMs} ms, and a Flow built from an unfinished recording silently loses the actions Core has not appended yet`;
  if (finishedReads === 1) return `Core reported the run's recording finished only at the ${timeoutMs} ms bound, so there was no confirming read before anything downstream could safely read it`;
  return `Core reported the run's recording finished but its timeline kept growing for ${timeoutMs} ms, so it was never safe to read`;
}

/**
 * Selects only the finalization wait's ids, booleans, counts and times for a
 * run-bundle error event. Other `recording.persistence` failures can carry
 * broader diagnostics and must not become evidence merely because they share
 * the category.
 */
export function finalizedRecordingWaitFailureDetails(error: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!(error instanceof RunnerFailure) || error.category !== "recording.persistence") return undefined;
  const details = error.details;
  if (
    typeof details?.recordingId !== "string"
    || typeof details.recordingSeen !== "boolean"
    || !(details.endedAt === null || finiteNumber(details.endedAt))
    || !(details.entryCount === null || finiteNumber(details.entryCount))
    || !(details.entriesAppendedWhileWaiting === null || finiteNumber(details.entriesAppendedWhileWaiting))
    || !finiteNumber(details.waitedMs)
    || !finiteNumber(details.polls)
    || !finiteNumber(details.timeoutMs)
  ) return undefined;
  return {
    recordingId: details.recordingId,
    recordingSeen: details.recordingSeen,
    endedAt: details.endedAt,
    entryCount: details.entryCount,
    entriesAppendedWhileWaiting: details.entriesAppendedWhileWaiting,
    waitedMs: details.waitedMs,
    polls: details.polls,
    timeoutMs: details.timeoutMs,
  };
}

/**
 * `summaries: true` is deliberate: it answers from the project's recording
 * index, which is rewritten on every append, so it carries both `endedAt` and
 * the live entry count without rehydrating each entry's state snapshot. The
 * unsummarised form would hydrate the whole timeline on every poll, adding
 * exactly the I/O load that widens the race being waited out.
 */
async function readRecording(control: FinalizedRecordingControl, input: { projectId: string; recordingId: string }, bounds: FluxIQHttpOptions): Promise<RecordingObservation> {
  const payload = await control.automationStudioCall("list-recordings", { projectId: input.projectId, summaries: true }, bounds);
  for (const value of recordingList(payload)) {
    const item = optionalRecord(value);
    const recordingId = item?.recordingId ?? item?.id;
    if (recordingId !== input.recordingId) continue;
    const endedAt = numberOrUndefined(item?.endedAt);
    return { seen: true, entryCount: entryCount(item), ...(endedAt === undefined ? {} : { endedAt }) };
  }
  return { seen: false, entryCount: 0 };
}

/** Accepts Core's envelope, `automationStudioCall`'s unwrapped payload, or a bare list. */
function recordingList(value: unknown): unknown[] {
  const payload = optionalRecord(value);
  const nested = optionalRecord(payload?.payload);
  for (const candidate of [payload?.recordings, nested?.recordings, payload?.items, nested?.items, value]) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

/** A summary carries its count in `metadata.eventCount`; a full session carries the timeline itself. */
function entryCount(item: Record<string, unknown> | undefined): number {
  const metadata = optionalRecord(item?.metadata);
  const counted = numberOrUndefined(metadata?.eventCount);
  if (counted !== undefined) return counted;
  return Array.isArray(item?.timeline) ? item.timeline.length : 0;
}

function optionalRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
