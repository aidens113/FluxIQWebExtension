import { setTimeout as delay } from "node:timers/promises";
import type { ExpectedEvent } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";
import { recordingEventTypeForKind } from "./recording-event-types.js";

export type RecordedEventAssertionOptions = { timeoutMs?: number; intervalMs?: number; now?: () => number; sleep?: (milliseconds: number) => Promise<unknown> };

type Mismatch = { type: string; expected: number | "at least 1"; actual: number };

/**
 * Asserts `expected.recordingEvents` against what the extension recorded: its
 * recording log, read by `readLog` as a tally by recorded kind (see
 * `readExtensionRecordingLog`), each kind mapped to the recording-domain event
 * type the manifest names. Executable and evidence events both count, since
 * the extension records and sends both. Core is not the source here: it stores
 * executable events as inputs and actions keyed by input id, which do not map
 * back to one event type. A listed `count` is exact; without one the type must
 * occur at least once; unlisted types are not checked. Events still travelling
 * from the page are waited for until `timeoutMs`. Returns the counts by type.
 */
export async function assertRecordedEvents(
  readLog: () => Promise<Record<string, number>>,
  expected: readonly ExpectedEvent[],
  options: RecordedEventAssertionOptions = {},
): Promise<Record<string, number>> {
  if (!expected.length) return {};
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? delay;
  const deadline = now() + (options.timeoutMs ?? 5_000);
  for (;;) {
    const tally = await readLog();
    const counts = eventTypeCounts(tally);
    const mismatches = compare(expected, counts);
    if (!mismatches.length) return counts;
    if (now() >= deadline) {
      throw new RunnerFailure("recording.contract", "Recorded events do not match the scenario's expected recording events", { details: { mismatches, recorded: counts, extensionRecorded: tally } });
    }
    await sleep(options.intervalMs ?? 250);
  }
}

function eventTypeCounts(tally: Record<string, number>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [key, count] of Object.entries(tally)) {
    const type = recordingEventTypeForKind(key.replace(/^evidence:/u, ""));
    counts[type] = (counts[type] ?? 0) + count;
  }
  return counts;
}

function compare(expected: readonly ExpectedEvent[], counts: Record<string, number>): Mismatch[] {
  const mismatches: Mismatch[] = [];
  for (const event of expected) {
    const actual = counts[event.type] ?? 0;
    if (event.count === undefined ? actual < 1 : actual !== event.count) mismatches.push({ type: event.type, expected: event.count ?? "at least 1", actual });
  }
  return mismatches;
}
