// What a replay's Core left in the project store's client gateway traces,
// read after that Core has stopped (lane T P2, D17): the traces this replay
// started, summarized as counts by `trace-inspection/`, and whether any secret
// the replay held reached a stored event or artifact. With tracing off the
// same read proves the off run stored no trace at all. Each trace is then
// replayed through Core's own gateway intake by Core's harness and its parity
// summarized (`trace-parity/`, lane T P3).

import path from "node:path";
import { inspectProjectTraces, type ProjectTraceInspection } from "../trace-inspection/index.js";
import { checkProjectTraceParity, type ProjectTraceParity } from "../trace-parity/index.js";

/** How many secrets of each source the search looked for: those the replay holds, the gateway tokens read from the extension, and the token reads that failed. */
export type ReplayTraceSecretSources = Readonly<{ replaySecrets: number; sessionTokens: number; sessionTokenReadFailures: number }>;

/**
 * `inspection` and `failure` are the read-back; `parity` the replay of each
 * trace through Core's intake, or `null` with `parityFailure` naming why (or
 * because the read-back itself failed, so no trace was known).
 */
export type ReplayTraceInspection = Readonly<{
  inspection: ProjectTraceInspection | null; failure: string | null; secretSources: ReplayTraceSecretSources;
  parity: ProjectTraceParity | null; parityFailure: string | null;
}>;

/**
 * Reads the traces started at or after `startedAt` in the project the replay
 * ran, under the workspace's storage directory (`<storage>/artifacts/automation-studio`,
 * where Core's web panel host keeps Automation Studio's projects). A store that
 * cannot be read is a failure named by its error, never a throw: the replay's
 * result is already decided.
 */
export async function inspectReplayTraces(
  input: { storageDir: string; projectId: string; startedAt: string; replaySecrets: readonly string[]; sessionTokens: readonly string[]; sessionTokenReadFailures: number },
  seams: { inspect?: typeof inspectProjectTraces; parity?: typeof checkProjectTraceParity } = {},
): Promise<ReplayTraceInspection> {
  const secretSources = Object.freeze({ replaySecrets: input.replaySecrets.length, sessionTokens: input.sessionTokens.length, sessionTokenReadFailures: input.sessionTokenReadFailures });
  const include = (manifest: { startedAt: string }) => manifest.startedAt >= input.startedAt;
  let automationDataDir: string;
  let inspection: ProjectTraceInspection;
  try {
    // Inside the try: even an unusable storage path is a named failure, never a throw.
    automationDataDir = path.join(input.storageDir, "artifacts", "automation-studio");
    inspection = await (seams.inspect ?? inspectProjectTraces)({ automationDataDir, projectId: input.projectId, include, secrets: [...input.replaySecrets, ...input.sessionTokens] });
  } catch (error) {
    const failure = error instanceof Error ? `${error.name}: ${error.message}` : "the trace store could not be read";
    return Object.freeze({ inspection: null, failure, secretSources, parity: null, parityFailure: "not run: the trace store could not be read" });
  }
  try {
    const parity = await (seams.parity ?? checkProjectTraceParity)({ automationDataDir, projectId: input.projectId, include });
    return Object.freeze({ inspection, failure: null, secretSources, parity, parityFailure: null });
  } catch (error) {
    // Only the error's kind: its text could quote what the store held.
    return Object.freeze({ inspection, failure: null, secretSources, parity: null, parityFailure: `the parity check threw ${error instanceof Error ? error.name : "a non-error value"} (text withheld)` });
  }
}
