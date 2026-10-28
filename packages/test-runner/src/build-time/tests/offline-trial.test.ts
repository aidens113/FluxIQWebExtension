import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { aggregateBuildTimes, classifyStep, measureBuildTime, readStepTimings, renderBuildTimeTable, type RunBuildTimeRow } from "../index.js";

// P6 (t769): a core.test_* call may first run offline against a recording. Core writes `NNNN-offline/meta.json`
// (kind `offline_trial`) inside the test tool's window. A kept answer (kept_no, kept_failed) ran nothing on the site.

const BASE = Date.parse("2026-10-27T10:00:00.000Z");
const at = (seconds: number) => new Date(BASE + seconds * 1000).toISOString();

type Meta = Record<string, unknown> & { from: number; to: number };

const tool = (toolId: string, from: number, to: number): Meta => ({ kind: "tool", toolId, callId: `call.${from}`, phase: "explore", part: "creation", from, to });
const model = (kind: string, from: number, to: number): Meta => ({ kind, provider: "deepseek", phase: "explore", part: "creation", from, to });
const offline = (outcome: string, from: number, to: number, trialToolId = "core.test_subflow"): Meta =>
  ({ kind: "offline_trial", trialToolId, outcome, callId: null, toolId: null, phase: "explore", part: "creation", from, to });
const reset = (from: number, to: number): Meta => ({ kind: "reset", stage: "site_check", callId: null, toolId: null, phase: "explore", part: "creation", from, to });

async function writeRun(t: test.TestContext, steps: readonly Meta[]): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "build-time-offline-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const stepsDirectory = path.join(directory, "steps");
  await mkdir(stepsDirectory, { recursive: true });
  for (const [offset, step] of steps.entries()) {
    const { from, to, ...fields } = step;
    const index = String(offset + 1).padStart(4, "0");
    const kind = String(fields.kind) === "offline_trial" ? "offline" : String(fields.kind);
    const folder = path.join(stepsDirectory, `${index}-${kind}${fields.kind === "tool" ? `-${String(fields.toolId)}` : ""}`);
    await mkdir(folder);
    await writeFile(path.join(folder, "meta.json"), JSON.stringify({ step: offset + 1, startedAt: at(from), finishedAt: at(to), ms: (to - from) * 1000, status: "ok", ...fields }));
  }
  return stepsDirectory;
}

const RUN: Meta[] = [
  model("decide", 0, 2),
  // Kept answer: the call ran nothing on the site.
  tool("core.test_subflow", 2, 6), offline("kept_no", 2.5, 4),
  // Offline passed, then the live trial ran with its reset.
  tool("core.test_subflow", 7, 30), offline("passed", 7.5, 9), reset(10, 12),
  // Not tried and refused: no offline work, live trial.
  tool("core.test_candidate", 31, 40), offline("not_tried", 31, 31.5, "core.test_candidate"),
  tool("core.test_candidate", 41, 50), offline("refused:no_recording", 41, 41, "core.test_candidate"),
  // A kept failure.
  tool("core.test_subflow", 51, 55), offline("kept_failed", 51.5, 53)
];

test("an offline_trial step is classified offline and reads its outcome", async t => {
  const { steps } = await readStepTimings(await writeRun(t, RUN));
  const offs = steps.filter(step => step.kind === "offline_trial");
  assert.equal(offs.length, 5);
  assert.deepEqual(offs.map(step => step.outcome), ["kept_no", "passed", "not_tried", "refused:no_recording", "kept_failed"]);
  for (const step of offs) assert.deepEqual(classifyStep(step), { category: "offline", rule: "offline-trial" });
  assert.equal(steps.find(step => step.kind === "decide")!.outcome, null);
});

test("offline time is carved out of its trial window, below reset and above trial", async t => {
  const { steps } = await readStepTimings(await writeRun(t, RUN));
  const m = measureBuildTime(steps);
  assert.equal(m.wallMs, 55_000);
  // Offline unions: 1.5 + 1.5 + 0.5 + 0 + 1.5 =s.
  assert.equal(m.union.offline, 5000);
  assert.equal(m.exclusive.offline, 5000);
  assert.equal(m.exclusive.reset, 2000);
  // Test windows 4 + 23 + 9 + 9 + 4 = 49 s less offlines and reset 2 s.
  assert.equal(m.union.trial, 49_000);
  assert.equal(m.exclusive.trial, 42_000);
  assert.equal(Object.values(m.exclusive).reduce((a, b) => a + b, 0), m.wallMs);
  assert.equal(m.ruleCounts["offline-trial"], 5);
  assert.deepEqual(m.unknown, {});
});

test("an overlap between offline and reset is reset time", async t => {
  const { steps } = await readStepTimings(await writeRun(t, [tool("core.test_subflow", 0, 10), offline("passed", 1, 5), reset(4, 6)]));
  const m = measureBuildTime(steps);
  assert.equal(m.exclusive.reset, 2000);
  assert.equal(m.exclusive.offline, 3000);
  assert.equal(m.exclusive.trial, 5000);
});

test("live trials are test windows without a kept offline answer; offline trials are the offline steps that ran", async t => {
  const { steps } = await readStepTimings(await writeRun(t, RUN));
  const m = measureBuildTime(steps);
  assert.equal(m.trialCount, 5);
  assert.equal(m.liveTrialCount, 3);
  // kept_no, passed, kept_failed ran; not_tried and refused did not.
  assert.equal(m.offlineTrialCount, 3);
});

test("without offline steps every trial is live", async t => {
  const { steps } = await readStepTimings(await writeRun(t, [tool("core.test_subflow", 0, 10), tool("core.test_candidate", 11, 12)]));
  const m = measureBuildTime(steps);
  assert.equal(m.liveTrialCount, 2);
  assert.equal(m.offlineTrialCount, 0);
  assert.equal(m.exclusive.offline, 0);
});

test("the totals pool the counts and the table shows offline and live trial columns", async t => {
  const { steps, incomplete } = await readStepTimings(await writeRun(t, RUN));
  const row: RunBuildTimeRow = { directory: "x", runId: "run-o", startedAt: at(0), verdict: "passed", task: "s/t", lane: "l", measured: measureBuildTime(steps), incomplete };
  const totals = aggregateBuildTimes([row, row]);
  assert.equal(totals.liveTrialCount, 6);
  assert.equal(totals.offlineTrialCount, 6);
  assert.equal(totals.trialCount, 10);
  assert.equal(totals.exclusive.offline, 10_000);
  assert.ok(Math.abs(Object.values(totals.share).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  const table = renderBuildTimeTable([row], totals);
  assert.match(table, /\| Offline \|/u);
  assert.match(table, /\| Live trials \| Offline trials \|/u);
  assert.match(table, /\| offline \| 0\.2 \| /u);
  assert.match(table, /\| offline-trial \| offline \| .* \| 10 \|/u);
  assert.match(table, /reset > offline > trial > model > exploration > other/u);
});

test("the table's header and divider have the same number of columns", async t => {
  const { steps, incomplete } = await readStepTimings(await writeRun(t, RUN));
  const row: RunBuildTimeRow = { directory: "x", runId: "run-o", startedAt: at(0), verdict: "passed", task: "s/t", lane: "l", measured: measureBuildTime(steps), incomplete };
  const [header, divider, line] = renderBuildTimeTable([row], aggregateBuildTimes([row])).split("\n");
  const columns = (text: string) => text.replaceAll(String.fromCharCode(92, 124), "").split("|").length;
  assert.equal(columns(divider!), columns(header!));
  assert.equal(columns(line!), columns(header!));
});
