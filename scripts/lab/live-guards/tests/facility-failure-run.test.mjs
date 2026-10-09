// A run that failed on the facility before any provider call never reached the
// product, so the `unchanged` rule does not count it as the source failing
// (lane A run `run-mv0fu9uq-107ab0de`: the Lab's `list-flows` read timed out
// before the instruction was typed, and the rule refused the task on that
// source). A facility failure after a provider call, or one whose call count
// is not certain, still counts.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkUnchangedRerun, closeLaunch, guardFiles, readLedger, readRunOutcomes } from "../index.mjs";

const T = Date.parse("2026-10-09T04:01:09.239Z");
const RUN = `run-${(T + 1_000).toString(36)}-107ab0de`;
const FINGERPRINT = "sha256:same";
const INSTANCE = "t342-slot-2";
const TASK = "crossborder-marketplace/crossborder-marketplace-hub-to-cart";
const TIMED_OUT = { boundary: "finalized-bundle", stage: "scenario.execute", reason: "http.timeout", operationStage: "control.request", timeoutMs: 10_000, endpoint: "/api/programs/automation-studio/list-flows" };

/** A finalized run bundle as the runner writes it, with an optional step log. */
async function machine({ facilityFailure = TIMED_OUT, calls = 0, liveLlm = null, stepMeta = null } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "live-guards-facility-"));
  const files = guardFiles(path.join(root, "lab-slots"));
  const runsDirectory = path.join(root, "runs");
  const bundle = path.join(runsDirectory, RUN);
  await mkdir(path.join(bundle, "snapshots"), { recursive: true });
  await mkdir(files.directory, { recursive: true });
  await writeFile(path.join(bundle, "run.json"), JSON.stringify({ runId: RUN, startedAt: new Date(T + 1_000).toISOString(), status: "failed", verdict: "failed" }));
  await writeFile(path.join(bundle, "evaluation.json"), JSON.stringify({ runId: RUN, verdict: "failed", failureCategory: "environment.missing", facilityFailure, llm: { mode: "live", profileId: "lab-create-flow", calls } }));
  if (liveLlm) await writeFile(path.join(bundle, "snapshots", "live-llm.json"), JSON.stringify(liveLlm));
  if (stepMeta) {
    const folder = path.join(files.labRuns, "2026-10-09", RUN, "steps", "0001-decide");
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, "meta.json"), JSON.stringify(stepMeta));
  }
  const start = { event: "start", launchId: "launch-8", at: new Date(T).toISOString(), pid: 1, instance: INSTANCE, scenarioId: "crossborder-marketplace", task: TASK, fingerprint: FINGERPRINT, repositoryRoot: root, runsDirectory, overridden: [] };
  return { root, files, runsDirectory, start };
}

const state = (files, entries) => ({ launch: { instance: INSTANCE, task: TASK }, entries, fingerprint: FINGERPRINT, files, hasDebug: () => true, debugPath: (runId) => `debugs/${runId}.md` });
const earlierFinish = (verdict) => ({ event: "finish", launchId: "launch-7", at: new Date(T - 3_600_000).toISOString(), runId: "run-earlier-00000000", instance: INSTANCE, task: TASK, verdict, totalEstimatedCostUsd: 0.03, balanceFailure: null, fingerprint: FINGERPRINT, exitCode: 1 });

test("a facility failure before any provider call is recorded on the finish and is not an unchanged failure", async () => {
  const { root, files, runsDirectory, start } = await machine();
  try {
    const [outcome] = await readRunOutcomes(runsDirectory, { sinceMs: T, knownRunIds: new Set(), labRunsDirectory: files.labRuns });
    assert.deepEqual(outcome.facilityFailureBeforeProvider, { stage: "scenario.execute", reason: "http.timeout", endpoint: "/api/programs/automation-studio/list-flows" });

    const { finishes } = await closeLaunch(files, start, [start], { exitCode: 1, now: T + 120_000, reconciled: false });
    assert.equal(finishes.length, 1);
    const [finish] = (await readLedger(files.ledger)).filter((entry) => entry.event === "finish");
    assert.equal(finish.runId, RUN);
    assert.equal(finish.verdict, "failed");
    assert.equal(finish.facilityFailureBeforeProvider.endpoint, "/api/programs/automation-studio/list-flows");

    assert.equal(checkUnchangedRerun(state(files, [start, finish])), null);
    // The run before it is the one compared: a product failure on the same source still refuses, and a pass still clears.
    const refusal = checkUnchangedRerun(state(files, [earlierFinish("failed"), start, finish]));
    assert.equal(refusal?.rule, "unchanged");
    assert.match(refusal.why, /run-earlier-00000000/u);
    assert.equal(checkUnchangedRerun(state(files, [earlierFinish("passed"), start, finish])), null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a facility failure is still a failure when a provider call was made, counted, or costed, or when its calls were not counted", async () => {
  const cases = [
    { name: "the evaluation counts calls", options: { calls: 3 } },
    { name: "the evaluation recorded no count", options: { calls: null } },
    { name: "the run recorded a cost", options: { liveLlm: { observed: { totalEstimatedCostUsd: 0.004 } } } },
    { name: "the step log holds a provider call", options: { stepMeta: { kind: "decide", provider: "deepseek", model: "deepseek-flash", status: "ok", httpStatus: 200, costUsd: 0.001, error: null } } },
    { name: "the run failed on the product, not the facility", options: { facilityFailure: null } },
  ];
  for (const { name, options } of cases) {
    const { root, files, runsDirectory, start } = await machine(options);
    try {
      const [outcome] = await readRunOutcomes(runsDirectory, { sinceMs: T, knownRunIds: new Set(), labRunsDirectory: files.labRuns });
      assert.equal(outcome.facilityFailureBeforeProvider, null, name);
      await closeLaunch(files, start, [start], { exitCode: 1, now: T + 120_000, reconciled: false });
      const entries = await readLedger(files.ledger);
      const finish = entries.find((entry) => entry.event === "finish");
      assert.equal("facilityFailureBeforeProvider" in finish, false, name);
      assert.equal(checkUnchangedRerun(state(files, entries))?.rule, "unchanged", name);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("only the diagnostic's closed codes are kept: an endpoint outside Core's API is left out", async () => {
  const { root, files, runsDirectory } = await machine({ facilityFailure: { ...TIMED_OUT, endpoint: "https://shop.example/cart?token=x" } });
  try {
    const [outcome] = await readRunOutcomes(runsDirectory, { sinceMs: T, knownRunIds: new Set(), labRunsDirectory: files.labRuns });
    assert.deepEqual(outcome.facilityFailureBeforeProvider, { stage: "scenario.execute", reason: "http.timeout" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
