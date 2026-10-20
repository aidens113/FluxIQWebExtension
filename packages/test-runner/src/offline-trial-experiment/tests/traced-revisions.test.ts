import assert from "node:assert/strict";
import test from "node:test";
import type { ClientGatewayTraceManifest } from "fluxiq/client-gateway";
import type { StoreTraceManifest } from "../store-trace-manifests.js";
import { tracedRevisions } from "../traced-revisions.js";
import type { LabSubflowSteps } from "../types.js";

function trace(traceId: string, episodeId: string, activity: string, context: unknown, events = 10): StoreTraceManifest {
  return { manifest: { traceId, episodeId, activity, context } as unknown as ClientGatewayTraceManifest, events, artifacts: 2 };
}
const trial = (revision: number, digest: string) => ({ schema: { name: "automation-studio.candidate-trial-context", version: "1" }, value: { kind: "candidate_trial", candidateId: "candidate.c", revision, digest, start: null } });

const steps: LabSubflowSteps = {
  submissions: [
    { step: 63, folder: "0063", briefId: "brief-1", subflowKey: "collect", revision: 3, digest: "s3", script: "a" },
    { step: 69, folder: "0069", briefId: "brief-1", subflowKey: "collect", revision: 4, digest: "s4", script: "b" },
    { step: 95, folder: "0095", briefId: "brief-1", subflowKey: "collect", revision: 4, digest: "s4", script: "b" },
    { step: 120, folder: "0120", briefId: "brief-1", subflowKey: "collect", revision: 4, digest: "s4", script: "b" },
  ],
  tests: [
    { step: 65, folder: "0065", briefId: "brief-1", revision: 3, digest: "s3", verdict: "execution_failed", code: "candidate.execution_incomplete", trialRunId: "trial.1", whole: { revision: 1, digest: "w1" }, storedRows: null },
    { step: 71, folder: "0071", briefId: "brief-1", revision: 4, digest: "s4", verdict: "execution_failed", code: "candidate.execution_incomplete", trialRunId: "trial.2", whole: { revision: 2, digest: "w2" }, storedRows: null },
    { step: 97, folder: "0097", briefId: "brief-1", revision: 4, digest: "s4", verdict: "no", code: "candidate.trial_judged_no", trialRunId: "trial.4", whole: { revision: 4, digest: "w2" }, storedRows: 15 },
  ],
};

test("maps each candidate trial's trace to its whole candidate, its test and the submission in force when it ran", () => {
  const mapped = tracedRevisions([
    trace("trace.explore", "build.b", "exploration", { schema: { name: "automation-studio.build-context", version: "1" }, value: { kind: "build" } }),
    trace("trace.1", "trial.1", "test", trial(1, "w1")),
    trace("trace.2", "trial.2", "test", trial(2, "w2")),
    trace("trace.4", "trial.4", "test", trial(4, "w2"), 118),
  ], steps);
  assert.deepEqual(mapped.map((entry) => [entry.traceId, entry.trialRunId, entry.candidateId, entry.whole.revision, entry.whole.digest, entry.test?.step, entry.subflow?.revision, entry.subflow?.submitStep]), [
    ["trace.1", "trial.1", "candidate.c", 1, "w1", 65, 3, 63],
    ["trace.2", "trial.2", "candidate.c", 2, "w2", 71, 4, 69],
    // The proposal was accepted again at 95, before this test: that submission was in force; 120 came after.
    ["trace.4", "trial.4", "candidate.c", 4, "w2", 97, 4, 95],
  ]);
  assert.equal(mapped[2]!.events, 118);
  assert.deepEqual(mapped[2]!.test, { step: 97, verdict: "no", code: "candidate.trial_judged_no", storedRows: 15 });
});

test("a trial no step names keeps its manifest's facts, and a test trace of another context is left out", () => {
  const mapped = tracedRevisions([
    trace("trace.9", "trial.9", "test", trial(9, "w9")),
    trace("trace.x", "replay.x", "test", { schema: { name: "automation-studio.saved-flow-replay", version: "1" }, value: { kind: "replay" } }),
  ], steps);
  assert.equal(mapped.length, 1);
  assert.equal(mapped[0]!.test, null);
  assert.equal(mapped[0]!.subflow, null);
  assert.deepEqual(mapped[0]!.whole, { revision: 9, digest: "w9" });
});
