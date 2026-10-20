// What an offline trial of the gate experiment is asked to run: the source
// trace it runs against (a live trial's), the candidate it runs (a recorded
// revision rebuilt and digest-verified, or a hand tier-1 correction Core
// compiled), the store both live in, and the live outcome the gate compares
// the offline one with.
//
// This is the experiment's side of the call only. Core's offline trial runner
// (trace plan P4c) is being written; the CLI hands it this request once it is
// exported (`./cli.ts`). The candidate carries its full plan, which holds page
// content: a request is written only under `test-runs/`, never printed.

import type { AutomationStudioFlowCandidate } from "fluxiq/automation-studio";
import type { CandidateRebuild, TracedRevision } from "./types.js";

export type OfflineTrialRequest = Readonly<{
  store: Readonly<{ automationDataDir: string; projectId: string; flowId: string }>;
  source: Readonly<{ traceId: string; trialRunId: string; candidateId: string; whole: Readonly<{ revision: number; digest: string }> }>;
  candidate: Readonly<{
    kind: "recorded_revision" | "tier1_correction";
    /** The build's candidate id: the offline trial runs a revision of the same candidate. */
    candidateId: string;
    briefId: string;
    /** The recorded subflow and whole receipts the rebuild was verified against; null for a correction. */
    recorded: Readonly<{ subflow: Readonly<{ revision: number; digest: string }> | null; whole: Readonly<{ revision: number; digest: string }> | null }> | null;
    /** Core's digests of the rebuilt candidate. */
    subflowDigest: string;
    wholeDigest: string;
    candidate: AutomationStudioFlowCandidate;
  }>;
  /** The live trial of this same candidate, where one ran: what the offline outcome is compared with. */
  liveTwin: Readonly<{ traceId: string; trialRunId: string; verdict: string | null; code: string | null; storedRows: number | null }> | null;
}>;

export function offlineTrialRequest(input: {
  store: OfflineTrialRequest["store"];
  source: TracedRevision;
  kind: OfflineTrialRequest["candidate"]["kind"];
  rebuild: CandidateRebuild;
  liveTwin: TracedRevision | null;
}): OfflineTrialRequest {
  const { rebuild } = input;
  if (!rebuild.candidate || rebuild.subflow.rebuiltDigest === null || rebuild.whole.rebuiltDigest === null) throw new Error("A refused rebuild makes no candidate to run");
  if (input.kind === "recorded_revision" && (rebuild.subflow.matches !== true || rebuild.whole.matches === false)) {
    throw new Error("The rebuilt candidate's digests do not equal the recorded ones, so it is not the revision that ran live");
  }
  return Object.freeze({
    store: input.store,
    source: Object.freeze({ traceId: input.source.traceId, trialRunId: input.source.trialRunId, candidateId: input.source.candidateId, whole: input.source.whole }),
    candidate: Object.freeze({
      kind: input.kind, candidateId: input.source.candidateId, briefId: rebuild.briefId,
      recorded: input.kind === "recorded_revision" ? Object.freeze({ subflow: rebuild.subflow.recorded, whole: rebuild.whole.recorded }) : null,
      subflowDigest: rebuild.subflow.rebuiltDigest, wholeDigest: rebuild.whole.rebuiltDigest, candidate: rebuild.candidate,
    }),
    liveTwin: input.liveTwin ? Object.freeze({ traceId: input.liveTwin.traceId, trialRunId: input.liveTwin.trialRunId, verdict: input.liveTwin.test?.verdict ?? null, code: input.liveTwin.test?.code ?? null, storedRows: input.liveTwin.test?.storedRows ?? null }) : null,
  });
}
