// Each `test` trace mapped to the candidate its trial ran (trace plan P4, the
// social gate experiment).
//
// The trace manifest's `candidate_trial` context names the whole candidate --
// its id, revision and digest -- and its episode is the trial's run id. The
// Lab's step files name the rest: the `core.test_subflow` step whose trial that
// run was carries the subflow proposal it was assembled from, and the latest
// accepted `core.submit_subflow` of that proposal before the test holds its
// script. A plan accepted again after another keeps its first revision and
// digest (Core t741), so a proposal can have several submitting steps; the
// latest before the test is the one in force when it ran.
//
// A trace whose context is not a candidate trial is left out; a trial no step
// names keeps its manifest's facts with `test` and `subflow` null.

import { jsonRecord } from "./json-record.js";
import type { StoreTraceManifest } from "./store-trace-manifests.js";
import type { LabSubflowSteps, TracedRevision } from "./types.js";

const TRIAL_CONTEXT = "automation-studio.candidate-trial-context";

export function tracedRevisions(traces: readonly StoreTraceManifest[], steps: LabSubflowSteps): readonly TracedRevision[] {
  const mapped: TracedRevision[] = [];
  for (const { manifest, events, artifacts } of traces) {
    if (manifest.activity !== "test") continue;
    const context = jsonRecord(manifest.context);
    const value = jsonRecord(context?.value);
    const schema = jsonRecord(context?.schema);
    if (schema?.name !== TRIAL_CONTEXT || value?.kind !== "candidate_trial") continue;
    if (typeof value.candidateId !== "string" || typeof value.revision !== "number" || typeof value.digest !== "string") continue;
    const test = steps.tests.find((candidate) => candidate.trialRunId === manifest.episodeId);
    const submission = test && test.revision !== null && test.digest !== null
      ? [...steps.submissions].reverse().find((candidate) => candidate.step < test.step && candidate.revision === test.revision && candidate.digest === test.digest && (test.briefId === null || candidate.briefId === test.briefId))
      : undefined;
    mapped.push(Object.freeze({
      traceId: manifest.traceId,
      trialRunId: manifest.episodeId,
      candidateId: value.candidateId,
      whole: Object.freeze({ revision: value.revision, digest: value.digest }),
      test: test ? Object.freeze({ step: test.step, verdict: test.verdict, code: test.code, storedRows: test.storedRows }) : null,
      subflow: test && submission ? Object.freeze({ briefId: submission.briefId, revision: submission.revision, digest: submission.digest, submitStep: submission.step }) : null,
      events,
      artifacts,
    }));
  }
  return Object.freeze(mapped);
}
