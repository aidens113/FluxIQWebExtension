import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { aggregateBuildTimes, measureBuildTime, readStepTimings, renderBuildTimeTable, type RunBuildTimeRow } from "../index.js";

const BASE = Date.parse("2026-10-19T10:00:00.000Z");
const at = (seconds: number) => new Date(BASE + seconds * 1000).toISOString();

type Step = { kind: string; from: number; to: number; toolId?: string; callId?: string; phase?: string; part?: string | null; provider?: string; round?: number; status?: string };

async function scratch(t: test.TestContext): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "build-time-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

/** Writes `steps/NNNN-<kind>/meta.json` folders; a `null` entry is a step folder with no meta yet. */
async function writeSteps(directory: string, steps: readonly (Step | null)[]): Promise<string> {
  const stepsDirectory = path.join(directory, "steps");
  await mkdir(stepsDirectory, { recursive: true });
  await writeFile(path.join(stepsDirectory, "index.md"), "# steps\n");
  for (const [offset, step] of steps.entries()) {
    const index = String(offset + 1).padStart(4, "0");
    const folder = path.join(stepsDirectory, step ? `${index}-${step.kind}${step.toolId ? `-${step.toolId}` : ""}` : `${index}-tool-x`);
    await mkdir(folder);
    if (!step) continue;
    const { from, to, part, ...fields } = step;
    await writeFile(path.join(folder, "meta.json"), JSON.stringify({ step: offset + 1, startedAt: at(from), finishedAt: at(to), ms: (to - from) * 1000, part: part === undefined ? "creation" : part, status: "ok", ...fields }));
  }
  return stepsDirectory;
}

const BUILD: (Step | null)[] = [
  { kind: "chat", from: 0, to: 2, provider: "deepseek", phase: "chat", part: null },
  { kind: "tool", toolId: "project.read_task", from: 3, to: 3.5, phase: "explore" },
  { kind: "decide", from: 4, to: 6, provider: "deepseek", phase: "explore" },
  { kind: "tool", toolId: "web.find_on_page", from: 6, to: 8, phase: "explore", status: "failed" },
  { kind: "tool", toolId: "project.dispatch", callId: "dispatch1", from: 8, to: 60, phase: "explore" },
  { kind: "tool", toolId: "core.run_node", from: 9, to: 14, phase: "explore" },
  { kind: "decide", from: 14, to: 16, provider: "deepseek", phase: "explore" },
  { kind: "tool", toolId: "core.test_subflow", from: 16, to: 40, phase: "explore" },
  { kind: "judge", from: 35, to: 38, provider: "deepseek", phase: "judge" },
  { kind: "decide", from: 40, to: 42, provider: "deepseek", phase: "explore" },
  { kind: "tool", toolId: "project.dispatch", callId: "dispatch.reset.1", from: 42, to: 50, phase: "explore" },
  { kind: "decide", from: 43, to: 45, provider: "deepseek", phase: "explore" },
  { kind: "tool", toolId: "core.run_node", callId: "reset.cart.1", from: 45, to: 49, phase: "explore" },
  { kind: "tool", toolId: "weird.tool", from: 50, to: 52, phase: "explore" },
  { kind: "mystery", from: 52, to: 53 },
  null,
  { kind: "tool", toolId: "core.test_candidate", from: 55, to: 58, phase: "explore" },
  { kind: "run", toolId: "web.browser.navigate", from: 62, to: 64, phase: "playback", part: null },
  { kind: "run", toolId: "web.dom.click", from: 65, to: 66, phase: "playback", part: null, status: "failed" },
  { kind: "judge", from: 66, to: 68, provider: "deepseek", phase: "judge", part: null },
  { kind: "decide", from: 70, to: 72, provider: "deepseek", phase: "repair", part: "reauthor" },
  { kind: "test", toolId: "core.run_node", from: 72, to: 74, phase: "test", part: "reauthor", round: 0 },
  { kind: "test", toolId: "core.run_node", from: 74.5, to: 76, phase: "test", part: "reauthor", round: 0 },
  { kind: "test", toolId: "core.run_node", from: 76, to: 78, phase: "test", part: "reauthor", round: 1 },
  { kind: "judge", from: 80, to: 81, provider: "deepseek", phase: "judge", part: null }
];

test("divides build wall time under trial > reset > model > exploration, with the remainder as other", async t => {
  const { steps, incomplete } = await readStepTimings(await writeSteps(await scratch(t), BUILD));
  assert.deepEqual(incomplete, ["0016-tool-x"]);
  const m = measureBuildTime(steps);
  // Wall: first step start (the chat, 0 s) to last build step end (81 s), less the playback window 62-68 s.
  assert.equal(m.buildStart, BASE);
  assert.equal(m.buildEnd, BASE + 81_000);
  assert.equal(m.playbackMs, 6000);
  assert.equal(m.wallMs, 75_000);
  // Trials: 16-40, 55-58, and the dry-run nodes 72-76 (round 0, its 0.5 s gap inside) and 76-78 (round 1).
  assert.equal(m.exclusive.trial, 33_000);
  assert.equal(m.trialCount, 4);
  assert.equal(m.longestTrialMs, 24_000);
  // The judge nested in the first trial is trial time, reported separately.
  assert.equal(m.modelInTrialMs, 3000);
  // The reset brief's window owns the decide inside it.
  assert.equal(m.exclusive.reset, 8000);
  assert.equal(m.union.model, 16_000);
  assert.equal(m.exclusive.model, 11_000);
  // A failed exploration step still spent its time.
  assert.equal(m.exclusive.exploration, 7000);
  assert.equal(m.exclusive.other, 16_000);
  assert.equal(m.idleMs, 12_500);
  assert.equal(Object.values(m.exclusive).reduce((a, b) => a + b, 0), m.wallMs);
  assert.deepEqual(m.unknown, { "tool:weird.tool": 1, "mystery:-": 1 });
  assert.equal(m.ruleCounts["dispatch"], 1);
  assert.equal(m.ruleCounts["playback-run"], 2);
  assert.equal(m.stepCount, 24);
});

test("a step without a valid finish is incomplete, not measured", async t => {
  const directory = await scratch(t);
  const stepsDirectory = await writeSteps(directory, [{ kind: "decide", from: 0, to: 1, provider: "deepseek" }]);
  await mkdir(path.join(stepsDirectory, "0002-tool-web.find_on_page"));
  await writeFile(path.join(stepsDirectory, "0002-tool-web.find_on_page", "meta.json"), JSON.stringify({ kind: "tool", toolId: "web.find_on_page", startedAt: at(1), finishedAt: null }));
  const { steps, incomplete } = await readStepTimings(stepsDirectory);
  assert.deepEqual(incomplete, ["0002-tool-web.find_on_page"]);
  assert.equal(measureBuildTime(steps).wallMs, 1000);
});

test("a run that is only playback has no build time; a lone part-less judge is model time", async t => {
  const only = await readStepTimings(await writeSteps(await scratch(t), [{ kind: "run", toolId: "web.dom.click", from: 0, to: 1, phase: "playback", part: null }]));
  assert.equal(measureBuildTime(only.steps).wallMs, 0);
  const lone = await readStepTimings(await writeSteps(await scratch(t), [{ kind: "judge", from: 0, to: 2, provider: "deepseek", part: null }]));
  const m = measureBuildTime(lone.steps);
  assert.equal(m.exclusive.model, 2000);
  assert.equal(m.playbackMs, 0);
});

test("the totals pool shares by time and the table lists every rule", async t => {
  const { steps, incomplete } = await readStepTimings(await writeSteps(await scratch(t), BUILD));
  const row: RunBuildTimeRow = { directory: "x", runId: "run-a", startedAt: at(0), verdict: "failed", task: "s/t|w", lane: "l", measured: measureBuildTime(steps), incomplete };
  const totals = aggregateBuildTimes([row, row]);
  assert.equal(totals.wallMs, 150_000);
  assert.equal(totals.incompleteSteps, 2);
  assert.equal(totals.trialCount, 8);
  assert.ok(Math.abs(Object.values(totals.share).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.equal(totals.share.trial, 33 / 75);
  assert.equal(totals.meanShare.trial, 33 / 75);
  const table = renderBuildTimeTable([row], totals);
  assert.match(table, /\| run-a \| s\/t\\\|w \| failed \| 1\.3 \| 44\.0% \|/u);
  assert.match(table, /tool:weird\.tool x2/u);
  assert.match(table, /\| reset-dispatch \| reset \|/u);
});
