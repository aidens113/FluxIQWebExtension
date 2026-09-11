import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseBenchReportJson, parseRunEvaluationJson, type WebScenario } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import type { RunScenarioOptions, RunScenarioResult } from "../../run-scenario.js";
import type { BenchCorpus } from "../corpus/index.js";
import { VARIANT_NEEDS_FLOW_LANE } from "../expand-corpus.js";
import type { BenchRunsFile } from "../report-store.js";
import { runBench, type RunBenchOptions } from "../run-bench.js";

// Only the fields resolveScenarioWorkflow reads.
const scenario = (id: string, extra: Partial<WebScenario> = {}): WebScenario => ({ id, recordingScript: [], expected: {}, ...extra }) as WebScenario;
const manifests = [
  scenario("basic-form", { workflows: [{ id: "combo", description: "A named workflow", recordingScript: [{ id: "open", operation: "click", target: "#open" }], expected: {} }] }),
  scenario("iframe-checkout", { variants: [{ id: "drift", description: "Drift", arm: { operation: "drift" }, expected: {} }] }),
];
const corpus: BenchCorpus = {
  id: "unit",
  description: "Unit corpus",
  rows: [
    { id: "W01", scenarioId: "basic-form", workflowId: null, unarmed: true, variantIds: [] },
    { id: "W02", scenarioId: "basic-form", workflowId: "combo", unarmed: true, variantIds: [] },
    { id: "W28", scenarioId: "iframe-checkout", workflowId: null, unarmed: true, variantIds: ["drift"] },
    { id: "W99", scenarioId: "iframe-checkout", workflowId: "missing", unarmed: true, variantIds: [] },
  ],
};

function runManifest(runId: string, scenarioId: string, verdict: "passed" | "failed") {
  return {
    schemaVersion: "0.1", runId, scenarioId, scenarioRevision: "a".repeat(64), seed: 1, status: verdict,
    startedAt: "2026-09-11T10:00:00.000Z", finishedAt: "2026-09-11T10:00:40.000Z",
    repositories: { facility: { path: "F:\\facility", commit: "b".repeat(40), dirty: false }, core: { path: "F:\\core", commit: "c".repeat(40), dirty: false } },
    compatibility: [], lockfiles: [], extension: { version: "0.1.0", sha256: "d".repeat(64), path: "apps/extension/dist/e2e-chromium" },
    environment: { os: "win32", architecture: "x64", browserName: "chromium", browserVersion: "Chrome/134.0.6998.35", locale: "en-US", timezone: "UTC", viewport: { width: 1280, height: 720 } },
    ports: {}, processExits: {}, artifacts: [], redactionState: "verified", verdict, fluxiqExecution: { targetMode: "isolated" },
    automationFailure: null, steps: [],
    actions: [{ actionType: "web.dom.type", startedAt: "2026-09-11T10:00:10.000Z", durationMs: 1_500, status: "succeeded" }],
  };
}

/** A runner that writes a minimal finalized bundle for each run and records what it was asked to run. */
function fakeRunner(calls: string[], verdictFor: (options: RunScenarioOptions) => "passed" | "failed" = () => "passed") {
  return async (options: RunScenarioOptions): Promise<RunScenarioResult> => {
    const runId = `run-unit-${calls.length}`;
    calls.push(`${options.scenarioId}/${options.workflowId ?? "primary"}/${options.evidence ?? "manifest"}`);
    const verdict = verdictFor(options);
    const runPath = path.join(options.runsDirectory, runId);
    await mkdir(runPath, { recursive: true });
    await writeFile(path.join(runPath, "run.json"), JSON.stringify(runManifest(runId, options.scenarioId, verdict)));
    await writeFile(path.join(runPath, "summary.json"), JSON.stringify({ verdict, metrics: { steps: 3 } }));
    await writeFile(path.join(runPath, "events.ndjson"), `${JSON.stringify({ sequence: 1, trigger: "step.start" })}\n${JSON.stringify({ sequence: 2, trigger: verdict === "passed" ? "final" : "error" })}\n`);
    return { runId, verdict, path: runPath, ...(verdict === "failed" ? { failureCategory: "runtime.behavior" } : {}) };
  };
}

const options = (root: string, overrides: Partial<RunBenchOptions>): RunBenchOptions => ({
  corpus, repeatCount: 2, target: { mode: "isolated" }, manifests,
  repositoryRoot: root, fluxiqRepositoryRoot: root, runsDirectory: path.join(root, "runs"), environment: {},
  runScenario: fakeRunner([]), inspectRun: async () => ({ valid: true }), ...overrides,
});
const readRuns = async (directory: string): Promise<BenchRunsFile> => JSON.parse(await readFile(path.join(directory, "runs.json"), "utf8")) as BenchRunsFile;

test("runs each runnable result once per repeat, one pass over the corpus at a time, and writes evaluations and a valid report", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-bench-run-"));
  try {
    const calls: string[] = [];
    const outcome = await runBench(options(root, { runScenario: fakeRunner(calls) }));
    assert.deepEqual(calls, ["basic-form/primary/manifest", "basic-form/combo/manifest", "iframe-checkout/primary/manifest", "basic-form/primary/manifest", "basic-form/combo/manifest", "iframe-checkout/primary/manifest"]);
    assert.deepEqual([outcome.status, outcome.results, outcome.runs, outcome.passed, outcome.skipped], ["passed", 3, 6, 6, 4]);
    assert.equal(path.dirname(outcome.directory), path.join(root, "runs", "bench"));
    const report = parseBenchReportJson(await readFile(path.join(outcome.directory, "report.json"), "utf8"));
    assert.deepEqual(report.workflows.map((workflow) => [workflow.corpusRowId, workflow.workflowId, workflow.flakeClass]), [["W01", null, "stable-pass"], ["W02", "combo", "stable-pass"], ["W28", null, "stable-pass"]]);
    assert.deepEqual([report.reportId, report.corpusId, report.repeatCount, report.target, report.llm.mode], [outcome.benchId, "unit", 2, "isolated", "disabled"]);
    assert.deepEqual(report.metrics.rates.initialExecutionSuccess, { count: 3, total: 3, workflows: 3, rate: 1 });
    assert.deepEqual(report.metrics.actionLatencyMs["web.dom.type"], { samples: 6, p50: 1_500, p95: 1_500 });
    const runs = await readRuns(outcome.directory);
    const skipped = runs.runs.filter((run) => run.status === "skipped");
    assert.deepEqual(skipped.map((run) => [run.corpusRowId, run.variantId, run.repeatIndex]), [["W28", "drift", 0], ["W28", "drift", 1], ["W99", null, 0], ["W99", null, 1]]);
    assert.equal(skipped[0]?.skipReason, VARIANT_NEEDS_FLOW_LANE);
    assert.match(skipped[2]?.skipReason ?? "", /^unresolved: .*no workflow missing/);
    const evaluated = runs.runs.filter((run) => run.status === "evaluated");
    assert.equal(evaluated.length, 6);
    for (const record of evaluated) {
      const evaluation = parseRunEvaluationJson(await readFile(path.join(outcome.directory, record.evaluation ?? "missing"), "utf8"));
      assert.deepEqual([evaluation.runId, evaluation.repeatIndex, evaluation.lane, evaluation.harnessActivations, evaluation.durationMs, evaluation.reportedVerdict], [record.runId, record.repeatIndex, "recording", 0, 40_000, "passed"]);
    }
    const markdown = await readFile(outcome.markdown, "utf8");
    assert.match(markdown, /## Skipped/);
    assert.ok(markdown.includes(VARIANT_NEEDS_FLOW_LANE));
    assert.match(markdown, /harnessActivations: 0: the recording lane runs no Flow/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a failing run fails the bench; a runner that throws is an inconclusive run, never a pass; --evidence passes through", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-bench-run-"));
  try {
    const calls: string[] = [];
    const runner = fakeRunner(calls, (run) => run.workflowId === "combo" ? "failed" : "passed");
    const outcome = await runBench(options(root, {
      repeatCount: 1, evidence: "events",
      runScenario: async (run) => {
        if (run.scenarioId === "iframe-checkout") throw new RunnerFailure("environment.missing", "Scenario Lab build is missing");
        return runner(run);
      },
    }));
    assert.deepEqual([outcome.status, outcome.runs, outcome.passed], ["failed", 3, 1]);
    assert.deepEqual(calls, ["basic-form/primary/events", "basic-form/combo/events"]);
    const runs = await readRuns(outcome.directory);
    const evaluated = runs.runs.filter((run) => run.status === "evaluated");
    assert.deepEqual(evaluated.map((run) => [run.corpusRowId, run.verdict, run.failureCategory ?? null]), [["W01", "passed", null], ["W02", "failed", "runtime.behavior"], ["W28", "inconclusive", "environment.missing"]]);
    assert.match(evaluated[2]?.problems?.[0] ?? "", /^runner: Scenario Lab build is missing/);
    const report = parseBenchReportJson(await readFile(path.join(outcome.directory, "report.json"), "utf8"));
    assert.deepEqual(report.workflows.map((workflow) => [workflow.corpusRowId, workflow.flakeClass]), [["W01", "stable-pass"], ["W02", "stable-fail"], ["W28", "stable-fail"]]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("refuses a target that runs a pre-existing Flow before running anything", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-bench-run-"));
  try {
    const calls: string[] = [];
    await assert.rejects(runBench(options(root, { target: { mode: "existing" } as unknown as RunBenchOptions["target"], runScenario: fakeRunner(calls) })), /recording lane/);
    assert.deepEqual(calls, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
