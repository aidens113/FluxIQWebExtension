import type { RunningTopology } from "../../coordinator.js";
import { RunnerFailure } from "../../failure.js";
import { awaitFinalizedRecording, type FinalizedRecording } from "../../flow-lane/index.js";
import { recordingIds } from "./recording-ids.js";

/** What Core reported about the session it kept and the recordings this run produced. */
export type CoreRoundTripOutcome = {
  sessionCount: number;
  recordingCount: number;
  newRecordingCount: number;
  newRecordingIds: string[];
  finalized: FinalizedRecording[];
};

/**
 * The recording a run produced, once Core has actually finished writing it.
 *
 * A recording *id* exists from `client.start_recording`, so the wait for one
 * to appear has always returned immediately -- and the caller then read a
 * recording Core was still appending to. `awaitFinalizedRecording` waits for
 * Core's own `endedAt`, which it stamps only after the stop drain and the
 * entry flush, so "Core persisted the completed recording" is true when this
 * says so rather than merely likely.
 */
export async function assertCoreRoundTrip(topology: RunningTopology, expectedSessionId?: string, recordingBaseline?: Set<string>): Promise<CoreRoundTripOutcome> {
  const snapshot = await topology.control!.gatewaySnapshot() as any;
  const sessions = snapshot?.payload?.sessions;
  if (!Array.isArray(sessions) || !sessions.some((session: any) => (session.status === "ready" || session.status === "connected") && (!expectedSessionId || session.sessionId === expectedSessionId))) throw new RunnerFailure("gateway.connection", "Core gateway snapshot has no matching paired extension session");
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const response = await topology.control!.listRecordings(topology.projectId!) as any;
    const ids = recordingIds(response);
    const newRecordingIds = recordingBaseline ? [...ids].filter(id => !recordingBaseline.has(id)) : [...ids];
    if (newRecordingIds.length) {
      // Only a baselined call knows which recordings this run produced; without
      // a baseline every recording in the project is "new", and an unrelated
      // open one must not fail the run. The Flow lane holds the same wait on
      // the exact recording it builds from, so the guarantee is not lost there.
      const finalized = recordingBaseline
        ? await Promise.all(newRecordingIds.map(recordingId => awaitFinalizedRecording(topology.control!, { projectId: topology.projectId!, recordingId })))
        : [];
      return { sessionCount: sessions.length, recordingCount: ids.size, newRecordingCount: newRecordingIds.length, newRecordingIds, finalized };
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new RunnerFailure("recording.persistence", recordingBaseline ? "Core did not persist a new recording for the completed scenario run" : "Core did not persist a recording for the completed scenario");
}
