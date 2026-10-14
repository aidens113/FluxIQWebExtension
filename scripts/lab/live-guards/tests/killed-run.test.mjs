// A run killed before its bundle was finalized: its spend, its empty balance
// and its debug duty reach the ledger from its step log (`run-muq0in9r-0793b448`
// cause 3), and it does not count as a failure of the source it ran.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { appendLedgerEntry, checkPreviousDebug, checkUnchangedRerun, guardFiles, readLedger, readRunOutcomes, reconcileLedger } from "../index.mjs";

const T = Date.parse("2026-10-01T20:54:21.819Z");
const RUN = `run-${(T + 9_000).toString(36)}-0793b448`;

async function machine() {
  const root = await mkdtemp(path.join(os.tmpdir(), "live-guards-killed-"));
  const files = guardFiles(path.join(root, "lab-slots"));
  const runsDirectory = path.join(root, "runs");
  await mkdir(files.directory, { recursive: true });
  await mkdir(path.join(runsDirectory, `.staging-${RUN}`), { recursive: true });
  return { root, files, runsDirectory };
}

async function step(files, name, meta) {
  const folder = path.join(files.labRuns, "2026-10-01", RUN, "steps", name);
  await mkdir(folder, { recursive: true });
  if (meta) await writeFile(path.join(folder, "meta.json"), JSON.stringify(meta));
}

const ok = (costUsd) => ({ kind: "decide", provider: "deepseek", model: "deepseek-flash", status: "ok", httpStatus: 200, costUsd, error: null, finishedAt: "2026-10-01T20:55:00.000Z" });

test("a staging run is read as killed, with the spend its step log proves", async () => {
  const { root, files, runsDirectory } = await machine();
  try {
    await step(files, "0001-chat", ok(0.000089658));
    await step(files, "0002-decide", ok(0.0123));
    await step(files, "0003-tool", { kind: "tool", status: "ok" });
    await step(files, "0004-decide", null);
    const outcomes = await readRunOutcomes(runsDirectory, { sinceMs: T, knownRunIds: new Set(), labRunsDirectory: files.labRuns });
    assert.equal(outcomes.length, 1);
    assert.equal(outcomes[0].runId, RUN);
    assert.equal(outcomes[0].verdict, "killed");
    assert.equal(outcomes[0].killed, true);
    assert.equal(outcomes[0].totalEstimatedCostUsd, 0.012389658);
    assert.equal(outcomes[0].balanceFailure, null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a staging run with no step log keeps its run id and an unknown cost; a finalized bundle of the same run wins", async () => {
  const { root, files, runsDirectory } = await machine();
  try {
    const unknown = await readRunOutcomes(runsDirectory, { sinceMs: T, knownRunIds: new Set(), labRunsDirectory: files.labRuns });
    assert.deepEqual(unknown.map((outcome) => [outcome.runId, outcome.totalEstimatedCostUsd]), [[RUN, null]]);
    await mkdir(path.join(runsDirectory, RUN, "snapshots"), { recursive: true });
    await writeFile(path.join(runsDirectory, RUN, "snapshots", "live-llm.json"), JSON.stringify({ observed: { totalEstimatedCostUsd: 0.05 } }));
    const finalized = await readRunOutcomes(runsDirectory, { sinceMs: T, knownRunIds: new Set(), labRunsDirectory: files.labRuns });
    assert.deepEqual(finalized.map((outcome) => [outcome.runId, outcome.totalEstimatedCostUsd, outcome.killed]), [[RUN, 0.05, undefined]]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reconciling a killed launch records its run and cost, stops on its empty balance, asks for its debug and is not an unchanged failure", async () => {
  const { root, files, runsDirectory } = await machine();
  try {
    await step(files, "0001-decide", ok(0.02));
    await step(files, "0002-decide", { ...ok(0), status: "failed", httpStatus: 402, costUsd: null, error: { code: "llm.provider_insufficient_balance" } });
    const start = { event: "start", launchId: "launch-1", at: new Date(T).toISOString(), pid: 20060, instance: "t194-slot-3", scenarioId: "everything-store", task: "everything-store/earbuds", fingerprint: "sha256:same", repositoryRoot: root, runsDirectory, overridden: [] };
    await appendLedgerEntry(files.ledger, { ...start, at: new Date(T - 3_600_000).toISOString(), launchId: "launch-0" });
    await appendLedgerEntry(files.ledger, { event: "finish", launchId: "launch-0", at: new Date(T - 3_000_000).toISOString(), runId: "run-earlier-00000000", instance: start.instance, task: start.task, verdict: "passed", totalEstimatedCostUsd: 0.04, balanceFailure: null, fingerprint: "sha256:same", exitCode: 0 });
    await appendLedgerEntry(files.ledger, start);
    await reconcileLedger(files, { now: T + 60_000, isAlive: () => false });
    const finish = (await readLedger(files.ledger)).find((entry) => entry.event === "finish" && entry.launchId === "launch-1");
    assert.equal(finish.runId, RUN);
    assert.equal(finish.killed, true);
    assert.equal(finish.totalEstimatedCostUsd, 0.02);
    assert.equal(finish.balanceFailure.httpStatus, 402);
    await access(files.stopBalance);

    const entries = await readLedger(files.ledger);
    const state = { launch: { instance: start.instance, task: start.task, authoringMode: "candidate" }, entries, fingerprint: "sha256:same", files, hasDebug: () => false, debugPath: (runId) => `debugs/${runId}.md` };
    assert.match(checkPreviousDebug(state)?.why ?? "", new RegExp(RUN));
    assert.equal(checkUnchangedRerun(state), null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// Run run-mv4912r9-53b05a51: `finalize` sealed the bundle (bundle.complete.json written) and the rename to its final
// name was refused while a reader held a file. Read as killed, its product failure skipped the `unchanged` rule.
async function seal(directory, { markerHash } = {}) {
  await mkdir(path.join(directory, "snapshots"), { recursive: true });
  await writeFile(path.join(directory, "run.json"), JSON.stringify({ startedAt: new Date(T + 9_000).toISOString(), status: "failed" }));
  await writeFile(path.join(directory, "evaluation.json"), JSON.stringify({ verdict: "failed", failureCategory: "runtime.behavior", facilityFailure: null, llm: { calls: 75 } }));
  await writeFile(path.join(directory, "snapshots", "live-llm.json"), JSON.stringify({ observed: { totalEstimatedCostUsd: 0.120331128, perBuild: { ceilingUsd: 0.1, builds: [{ phase: "build", attempt: 1, estimatedCostUsd: 0.04248 }, { phase: "repair", attempt: 1, estimatedCostUsd: 0.0734 }] } } }));
  const index = Buffer.from(JSON.stringify({ schemaVersion: "0.1", artifacts: [] }));
  await writeFile(path.join(directory, "artifact-index.json"), index);
  await writeFile(path.join(directory, "bundle.complete.json"), JSON.stringify({ schemaVersion: "0.1", artifactIndexSha256: markerHash ?? createHash("sha256").update(index).digest("hex") }));
}

test("a sealed staging run that could not be published is read as finalized, with its own verdict and cost, not as killed", async () => {
  const { root, files, runsDirectory } = await machine();
  try {
    await seal(path.join(runsDirectory, `.staging-${RUN}`));
    await step(files, "0001-decide", ok(0.5));
    const [outcome, ...rest] = await readRunOutcomes(runsDirectory, { sinceMs: T, knownRunIds: new Set(), labRunsDirectory: files.labRuns });
    assert.deepEqual(rest, []);
    assert.equal(outcome.runId, RUN);
    assert.equal(outcome.verdict, "failed");
    assert.equal(outcome.killed, undefined);
    assert.equal(outcome.unpublished, true);
    assert.equal(outcome.totalEstimatedCostUsd, 0.120331128, "the bundle's own cost, not the step log's");
    // One purse per Flow (t438, "$0.1 per flow max"): the Flow's whole spend is its build figure, and it was over.
    assert.deepEqual([outcome.buildCeilingUsd, outcome.maxBuildCostUsd, outcome.buildsOverCeiling], [0.1, 0.120331128, 1]);
    assert.equal(outcome.balanceFailure, null);
    assert.equal(outcome.facilityFailureBeforeProvider, null);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a staging run whose marker does not match its index is still a kill", async () => {
  const { root, files, runsDirectory } = await machine();
  try {
    await seal(path.join(runsDirectory, `.staging-${RUN}`), { markerHash: "0".repeat(64) });
    const [outcome] = await readRunOutcomes(runsDirectory, { sinceMs: T, knownRunIds: new Set(), labRunsDirectory: files.labRuns });
    assert.deepEqual([outcome.verdict, outcome.killed, outcome.unpublished], ["killed", true, undefined]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("an unpublished run's empty balance comes from its step log when it has no provider-failure sidecar", async () => {
  const { root, files, runsDirectory } = await machine();
  try {
    await seal(path.join(runsDirectory, `.staging-${RUN}`));
    await step(files, "0001-decide", { ...ok(0), status: "failed", httpStatus: 402, costUsd: null, error: { code: "llm.provider_insufficient_balance" } });
    const [outcome] = await readRunOutcomes(runsDirectory, { sinceMs: T, knownRunIds: new Set(), labRunsDirectory: files.labRuns });
    assert.equal(outcome.unpublished, true);
    assert.equal(outcome.balanceFailure?.httpStatus, 402);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a sealed but unpublished product failure counts against the unchanged source", async () => {
  const { root, files, runsDirectory } = await machine();
  try {
    await seal(path.join(runsDirectory, `.staging-${RUN}`));
    const start = { event: "start", launchId: "launch-1", at: new Date(T).toISOString(), pid: 20060, instance: "t418-proofs", scenarioId: "crossborder-marketplace", task: "crossborder-marketplace/flash-deal", authoringMode: "candidate", fingerprint: "sha256:same", repositoryRoot: root, runsDirectory, overridden: [] };
    await appendLedgerEntry(files.ledger, start);
    await reconcileLedger(files, { now: T + 60_000, isAlive: () => false });
    const entries = await readLedger(files.ledger);
    const finish = entries.find((entry) => entry.event === "finish" && entry.launchId === "launch-1");
    assert.deepEqual([finish.runId, finish.verdict, finish.killed, finish.totalEstimatedCostUsd], [RUN, "failed", undefined, 0.120331128]);
    const state = { launch: { instance: start.instance, task: start.task, authoringMode: "candidate" }, entries, fingerprint: "sha256:same", files, hasDebug: () => false, debugPath: (runId) => `debugs/${runId}.md` };
    assert.match(checkUnchangedRerun(state)?.why ?? "", new RegExp(`${RUN}, which ended failed`));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
