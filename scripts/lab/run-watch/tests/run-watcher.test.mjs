// The watcher over real step folders on disk: it reads a step only once its
// meta.json exists, writes an alert line only when a pattern holds, mirrors it to the launch file,
// keeps the heartbeat to once per interval, finds a launch's run folder, and parses `lab watch`.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { WATCH_THRESHOLDS, createRunWatcher, findNewRuns, parseWatchArguments, replaySteps, startLabWatcher } from "../index.mjs";

const THRESHOLDS = { ...WATCH_THRESHOLDS, noActAfterLoopDecisions: 2, repeatedCalls: 3, pollMs: 20, heartbeatMs: 30_000 };

async function temp() { return mkdtemp(path.join(os.tmpdir(), "run-watch-test-")); }

/** Writes one step folder, meta last, as Core does. */
async function step(steps, number, kind, { toolId, callId, input, meta = {}, result, page } = {}) {
  const name = `${String(number).padStart(4, "0")}-${kind}${toolId ? `-${toolId}` : ""}`;
  const directory = path.join(steps, name);
  await mkdir(directory, { recursive: true });
  if (input !== undefined) await writeFile(path.join(directory, "call.json"), JSON.stringify({ callId: callId ?? "call.1", toolId, input }));
  if (result !== undefined) await writeFile(path.join(directory, "result.json"), JSON.stringify(result));
  if (page !== undefined) await writeFile(path.join(directory, "page.txt"), page);
  await writeFile(path.join(directory, "meta.json"), JSON.stringify({ step: number, kind, toolId: toolId ?? null, costUsd: 0.01, ...meta }));
}
const click = (n) => ({ toolId: "core.run_node", input: { node: "web.output.dom-click", parameters: { target: { handle: `t${n}` } } }, result: { page: { location: `http://site/${n}` } }, page: `page ${n}` });

test("a stuck run alerts, writes the file, mirrors it, and prints one short line", async () => {
  const root = await temp();
  try {
    const evidence = path.join(root, "run-1");
    const steps = path.join(evidence, "steps");
    await step(steps, 1, "loop", { meta: { pattern: "cycle" } });
    for (let number = 2; number <= 5; number += 1) await step(steps, number, "decide");
    const mirror = path.join(root, "launch", "watch-alerts.ndjson");
    const printed = [];
    const watcher = createRunWatcher({ stepsDirectory: steps, evidenceDirectory: evidence, mirrorAlertFiles: [mirror], thresholds: THRESHOLDS, print: (line) => printed.push(line) });
    await watcher.poll();
    const lines = (await readFile(path.join(evidence, "watch-alerts.ndjson"), "utf8")).trim().split("\n").map((line) => JSON.parse(line));
    assert.equal(lines.length, 2);
    assert.equal(lines[0].pattern, "no_act_after_loop");
    assert.deepEqual(lines[0].steps, [1, 3]);
    assert.equal(lines[0].runId, "run-1");
    assert.equal((await readFile(mirror, "utf8")).trim().split("\n").length, 2);
    assert.equal(printed.length, 2);
    assert.match(printed[0], /^\[watch\] run-1 no_act_after_loop/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a run that acts and moves on writes no alert file at all", async () => {
  const root = await temp();
  try {
    const evidence = path.join(root, "run-2");
    const steps = path.join(evidence, "steps");
    await step(steps, 1, "chat");
    for (let number = 2; number <= 11; number += 2) {
      await step(steps, number, "decide");
      await step(steps, number + 1, "tool", click(number));
    }
    const { alerts } = await replaySteps({ stepsDirectory: steps, evidenceDirectory: evidence });
    assert.deepEqual(alerts, []);
    await assert.rejects(readFile(path.join(evidence, "watch-alerts.ndjson"), "utf8"), { code: "ENOENT" });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a step without its meta.json is left until it finishes, and the heartbeat is rewritten at most once per interval", async () => {
  const root = await temp();
  try {
    const evidence = path.join(root, "run-3");
    const steps = path.join(evidence, "steps");
    await mkdir(path.join(steps, "0001-decide"), { recursive: true });
    let clock = 1_000_000;
    const watcher = createRunWatcher({ stepsDirectory: steps, evidenceDirectory: evidence, thresholds: THRESHOLDS, now: () => clock });
    await watcher.poll();
    const status = path.join(evidence, "watch-status.json");
    assert.equal(JSON.parse(await readFile(status, "utf8")).steps, 0);
    await step(steps, 1, "decide");
    await step(steps, 2, "tool", click(2));
    clock += 5_000;
    await watcher.poll();
    assert.equal(JSON.parse(await readFile(status, "utf8")).steps, 0, "inside the interval the heartbeat is not rewritten");
    clock += 30_000;
    await watcher.poll();
    const after = JSON.parse(await readFile(status, "utf8"));
    assert.deepEqual([after.steps, after.acts, after.finished], [2, 1, false]);
    await watcher.finish();
    assert.equal(JSON.parse(await readFile(status, "utf8")).finished, true);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a launch's run folder is found by its process or instance, and not another launch's", async () => {
  const root = await temp();
  try {
    const entry = async (date, runId, body) => {
      await mkdir(path.join(root, date, runId, "steps"), { recursive: true });
      await writeFile(path.join(root, date, runId, "entry.json"), JSON.stringify(body));
    };
    const since = Date.parse("2026-11-24T10:00:00Z");
    await entry("2026-11-24", "run-ours", { startedAt: "2026-11-24T10:00:05Z", pid: 41, instance: "a" });
    await entry("2026-11-24", "run-other", { startedAt: "2026-11-24T10:00:06Z", pid: 99, instance: "b" });
    await entry("2026-11-24", "run-old", { startedAt: "2026-11-24T09:00:00Z", pid: 41, instance: "a" });
    assert.deepEqual((await findNewRuns(root, { sinceMs: since, pid: 41 })).map((run) => run.runId), ["run-ours"]);
    assert.deepEqual((await findNewRuns(root, { sinceMs: since, pid: null, instance: "b" })).map((run) => run.runId), ["run-other"]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("the launch watcher announces its alert file up front and mirrors a run's alerts into it", async () => {
  const root = await temp();
  try {
    const runs = path.join(root, "lab-runs");
    const evidence = path.join(runs, "2026-11-24", "run-live");
    await mkdir(path.join(evidence, "steps"), { recursive: true });
    const printed = [];
    const watcher = await startLabWatcher({ runsRoot: runs, launchDirectory: path.join(root, "launch"), instance: "lane", thresholds: THRESHOLDS, print: (line) => printed.push(line), now: () => Date.parse("2026-11-24T10:00:00Z") });
    assert.match(printed[0], /watch-alerts\.ndjson/u);
    assert.equal(await readFile(watcher.launchAlertsFile, "utf8"), "");
    await writeFile(path.join(evidence, "entry.json"), JSON.stringify({ startedAt: "2026-11-24T10:00:01Z", pid: 7, instance: "lane" }));
    await step(path.join(evidence, "steps"), 1, "loop");
    for (let number = 2; number <= 4; number += 1) await step(path.join(evidence, "steps"), number, "decide");
    const alerts = await watcher.stop();
    assert.equal(alerts.length, 1);
    assert.match(await readFile(watcher.launchAlertsFile, "utf8"), /no_act_after_loop/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("lab watch parses a replay, a follow and an evidence folder, and refuses anything else with the usage", () => {
  assert.deepEqual(parseWatchArguments(["--from-steps", "a/steps"]), { mode: "replay", stepsDirectory: "a/steps", evidenceDirectory: null });
  assert.deepEqual(parseWatchArguments(["--steps", "a/steps", "--evidence", "out"]), { mode: "watch", stepsDirectory: "a/steps", evidenceDirectory: "out" });
  for (const bad of [[], ["--from-steps"], ["--from-steps", "--evidence"], ["--from-steps", "a", "--steps", "b"], ["--nope", "x"]]) assert.match(parseWatchArguments(bad).error, /usage|needs|unknown|one of/u, bad.join(" "));
});
