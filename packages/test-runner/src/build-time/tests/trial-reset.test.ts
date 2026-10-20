import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { aggregateBuildTimes, classifyStep, measureBuildTime, readStepTimings, renderBuildTimeTable, type RunBuildTimeRow } from "../index.js";

// Core's reset steps inside a trial (t737): `NNNN-reset` folders that Core's step log writes around a trial's start
// hook and its site check, inside the core.test_subflow / core.test_candidate window. Their time is reset time,
// carved out of the trial without double counting where two reset steps overlap.

const BASE = Date.parse("2026-10-20T10:00:00.000Z");
const at = (seconds: number) => new Date(BASE + seconds * 1000).toISOString();

type Meta = Record<string, unknown> & { from: number; to: number };

/** A tool or model step as Core's step log writes its `meta.json`. */
const tool = (toolId: string, from: number, to: number): Meta => ({ kind: "tool", toolId, callId: `call.${from}`, phase: "explore", part: "creation", from, to });
const model = (kind: string, from: number, to: number): Meta => ({ kind, provider: "deepseek", phase: kind === "judge" ? "judge" : "explore", part: "creation", from, to });
/** A reset step exactly as `reset-step.ts` in Core writes it: kind `reset`, no tool id, no call id. */
const reset = (stage: "start_hook" | "site_check", from: number, to: number, trialToolId: string | null = null): Meta =>
  ({ kind: "reset", stage, trialToolId, callId: null, toolId: null, phase: "explore", part: "creation", round: 1, outcome: stage === "start_hook" ? "reset" : "admit", from, to });

async function writeRun(t: test.TestContext, steps: readonly Meta[]): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "build-time-reset-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const stepsDirectory = path.join(directory, "steps");
  await mkdir(stepsDirectory, { recursive: true });
  for (const [offset, step] of steps.entries()) {
    const { from, to, ...fields } = step;
    const index = String(offset + 1).padStart(4, "0");
    const folder = path.join(stepsDirectory, `${index}-${String(fields.kind)}${fields.kind === "tool" ? `-${String(fields.toolId)}` : ""}`);
    await mkdir(folder);
    await writeFile(path.join(folder, "meta.json"), JSON.stringify({ step: offset + 1, startedAt: at(from), finishedAt: at(to), ms: (to - from) * 1000, status: "ok", ...fields }));
  }
  return stepsDirectory;
}

const RUN: Meta[] = [
  model("decide", 0, 2),
  tool("core.test_subflow", 2, 30),
  // The gate's start hook, then its site check; they overlap by a second, counted once.
  reset("start_hook", 3, 8),
  reset("site_check", 7, 12, "core.test_subflow"),
  model("judge", 25, 28),
  tool("core.test_candidate", 31, 40),
  reset("start_hook", 31, 34),
  reset("site_check", 34, 36, "core.test_candidate"),
  model("decide", 40, 42),
  // A start hook outside any trial (the judged whole run's): reset time as well.
  reset("start_hook", 43, 45)
];

test("a reset step is classified reset by the trial-reset rule", async t => {
  const { steps, incomplete } = await readStepTimings(await writeRun(t, RUN));
  assert.deepEqual(incomplete, []);
  const resets = steps.filter(step => step.kind === "reset");
  assert.equal(resets.length, 5);
  for (const step of resets) assert.deepEqual(classifyStep(step), { category: "reset", rule: "trial-reset" });
});

test("reset steps inside a trial window are reset time, carved out of the trial once", async t => {
  const { steps } = await readStepTimings(await writeRun(t, RUN));
  const m = measureBuildTime(steps);
  assert.equal(m.wallMs, 45_000);
  // Trial windows 2-30 and 31-40 (37 s) less their resets 3-12 and 31-36 (14 s; the 7-8 overlap once).
  assert.equal(m.exclusive.trial, 23_000);
  // Those 14 s plus the start hook at 43-45 outside every trial.
  assert.equal(m.exclusive.reset, 16_000);
  assert.equal(m.union.reset, 16_000);
  // The unions keep overlaps: the trial windows are still 37 s of their own.
  assert.equal(m.union.trial, 37_000);
  assert.equal(m.resetInTrialMs, 14_000);
  // The judge at 25-28 is still trial time, reported beside it; the decides are model time.
  assert.equal(m.modelInTrialMs, 3000);
  assert.equal(m.exclusive.model, 4000);
  // Idle gaps 30-31 and 42-43.
  assert.equal(m.exclusive.other, 2000);
  assert.equal(m.idleMs, 2000);
  assert.equal(Object.values(m.exclusive).reduce((a, b) => a + b, 0), m.wallMs);
  // A trial is still counted, and measured, by its whole tool window.
  assert.equal(m.trialCount, 2);
  assert.equal(m.longestTrialMs, 28_000);
  assert.equal(m.ruleCounts["trial-reset"], 5);
  assert.deepEqual(m.unknown, {});
});

test("a reset step that reaches past its trial's window is reset for all of it, and the trial loses only the overlap", async t => {
  const { steps } = await readStepTimings(await writeRun(t, [tool("core.test_candidate", 0, 10), reset("site_check", 8, 12, "core.test_candidate")]));
  const m = measureBuildTime(steps);
  assert.equal(m.wallMs, 12_000);
  assert.equal(m.exclusive.trial, 8000);
  assert.equal(m.exclusive.reset, 4000);
  assert.equal(m.resetInTrialMs, 2000);
});

test("the report says reset time inside trials is counted as reset and lists the rule", async t => {
  const { steps, incomplete } = await readStepTimings(await writeRun(t, RUN));
  const row: RunBuildTimeRow = { directory: "x", runId: "run-r", startedAt: at(0), verdict: "passed", task: "s/t", lane: "l", measured: measureBuildTime(steps), incomplete };
  const totals = aggregateBuildTimes([row]);
  assert.equal(totals.resetInTrialMs, 14_000);
  const table = renderBuildTimeTable([row], totals);
  assert.match(table, /Reset time inside trials \(counted as reset, not trial\): 0\.2 min/u);
  assert.match(table, /\| trial-reset \| reset \| .* \| 5 \|/u);
});
