// What a replay's Core left in the project store's client gateway traces,
// read after that Core has stopped (lane T P2, D17): the traces this replay
// started, summarized as counts by `trace-inspection/`, and whether any secret
// the replay held reached a stored event or artifact. With tracing off the
// same read proves the off run stored no trace at all.

import path from "node:path";
import { inspectProjectTraces, type ProjectTraceInspection } from "../trace-inspection/index.js";

/** How many secrets of each source the search looked for: those the replay holds, the gateway tokens read from the extension, and the token reads that failed. */
export type ReplayTraceSecretSources = Readonly<{ replaySecrets: number; sessionTokens: number; sessionTokenReadFailures: number }>;

export type ReplayTraceInspection = Readonly<{ inspection: ProjectTraceInspection | null; failure: string | null; secretSources: ReplayTraceSecretSources }>;

/**
 * Reads the traces started at or after `startedAt` in the project the replay
 * ran, under the workspace's storage directory (`<storage>/artifacts/automation-studio`,
 * where Core's web panel host keeps Automation Studio's projects). A store that
 * cannot be read is a failure named by its error, never a throw: the replay's
 * result is already decided.
 */
export async function inspectReplayTraces(
  input: { storageDir: string; projectId: string; startedAt: string; replaySecrets: readonly string[]; sessionTokens: readonly string[]; sessionTokenReadFailures: number },
  seams: { inspect?: typeof inspectProjectTraces } = {},
): Promise<ReplayTraceInspection> {
  const secretSources = Object.freeze({ replaySecrets: input.replaySecrets.length, sessionTokens: input.sessionTokens.length, sessionTokenReadFailures: input.sessionTokenReadFailures });
  try {
    const inspection = await (seams.inspect ?? inspectProjectTraces)({
      automationDataDir: path.join(input.storageDir, "artifacts", "automation-studio"),
      projectId: input.projectId,
      include: manifest => manifest.startedAt >= input.startedAt,
      secrets: [...input.replaySecrets, ...input.sessionTokens],
    });
    return Object.freeze({ inspection, failure: null, secretSources });
  } catch (error) {
    return Object.freeze({ inspection: null, failure: error instanceof Error ? `${error.name}: ${error.message}` : "the trace store could not be read", secretSources });
  }
}
