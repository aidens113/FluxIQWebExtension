import { RunnerFailure } from "../../../failure.js";
import { recordingIds } from "../../../run-scenario/core-round-trip/recording-ids.js";

/** The recording this lane's person made and attached. */
export type RecordedDemonstrationIdentity = Readonly<{ recordingId: string; description: string }>;

/**
 * What the project's recordings must look like once a recorded-evidence build has ended: the set
 * changed by exactly the demonstration's recording and by nothing else, that recording finalized
 * and carrying the description the person gave it. It replaces the instruction-only lanes'
 * `assertRecordingSetUnchanged`, whose claim -- the build recorded nothing -- is the opposite one.
 * A build that deleted a recording, made a second one, or left this one open is a Lab or product
 * defect, never a pass.
 */
export function assertRecordingSetChangedByExactly(before: ReadonlySet<string>, afterResponse: unknown, expected: RecordedDemonstrationIdentity): void {
  const after = recordingIds(afterResponse);
  const added = [...after].filter((id) => !before.has(id));
  const removed = [...before].filter((id) => !after.has(id));
  if (removed.length > 0 || added.length !== 1 || added[0] !== expected.recordingId) {
    throw new RunnerFailure("recording.persistence", `The project's recordings changed by ${added.length} added and ${removed.length} removed; the recorded-evidence lane expects exactly the demonstration's recording ${expected.recordingId} added`, { details: { fact: "recording.set", added: added.length, removed: removed.length } });
  }
  const item = recordingItems(afterResponse).find((candidate) => (candidate.recordingId ?? candidate.id) === expected.recordingId);
  if (typeof item?.endedAt !== "number") throw new RunnerFailure("recording.persistence", `The demonstration's recording ${expected.recordingId} was not finalized (Core stamped no endedAt)`, { details: { fact: "recording.finalized" } });
  const described = typeof item.description === "string" ? item.description.trim() : "";
  if (described !== expected.description.trim()) throw new RunnerFailure("recording.persistence", `The demonstration's recording ${expected.recordingId} does not carry the description the person gave it`, { details: { fact: "recording.described" } });
}

/** The items of Core's `list-recordings`, whichever envelope it arrived in (see `recordingIds`). */
export function recordingItems(response: unknown): Array<Record<string, unknown>> {
  const record = response !== null && typeof response === "object" ? response as Record<string, any> : {};
  const values = record.payload?.recordings ?? record.payload?.items ?? record.payload ?? record.recordings ?? record.items;
  return Array.isArray(values) ? values.filter((value): value is Record<string, unknown> => value !== null && typeof value === "object") : [];
}
