import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { LabRunRecord, labRunsRoot, localDateTime, type LabRunEntry } from "../index.js";

async function scratch(t: test.TestContext): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lab-run-record-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

const STARTED_AT = "2026-10-01T12:34:56.000Z";

async function openRecord(root: string, overrides: Partial<Parameters<typeof LabRunRecord.open>[0]> = {}) {
  const lines: string[] = [];
  const record = await LabRunRecord.open({
    environment: { FLUXIQ_LAB_RUNS_DIR: root, FLUXIQ_LAB_LANE: "lane-b", FLUXIQ_LAB_INSTANCE: "slot-2" },
    runId: "run-abc", startedAt: STARTED_AT, scenarioId: "auction-marketplace", work: "watch-lot", variantId: "drift",
    bundlePath: path.join(root, "test-runs", "run-abc"), repositoryRoot: "C:/repo", log: line => lines.push(line), ...overrides,
  });
  return { record, lines };
}

test("the runs root is FLUXIQ_LAB_RUNS_DIR when absolute, else ~/FluxStuff/lab-runs", () => {
  const absolute = path.resolve("somewhere", "lab-runs");
  assert.equal(labRunsRoot({ FLUXIQ_LAB_RUNS_DIR: absolute }), absolute);
  assert.equal(labRunsRoot({ FLUXIQ_LAB_RUNS_DIR: "relative/lab-runs" }), path.join(os.homedir(), "FluxStuff", "lab-runs"));
  assert.equal(labRunsRoot({}), path.join(os.homedir(), "FluxStuff", "lab-runs"));
});

test("open files the run under its local start date, writes a running entry and its steps folder, and indexes it", async t => {
  const root = await scratch(t);
  const { record, lines } = await openRecord(root);
  const folder = path.join(root, localDateTime(new Date(STARTED_AT)).date, "run-abc");
  assert.equal(record.folder, folder);
  assert.equal(record.stepsDirectory, path.join(folder, "steps"));
  assert.ok((await lstat(path.join(folder, "steps"))).isDirectory());
  const entry = JSON.parse(await readFile(path.join(folder, "entry.json"), "utf8")) as LabRunEntry;
  assert.deepEqual(entry, {
    runId: "run-abc", startedAt: STARTED_AT, pid: process.pid, lane: "lane-b", instance: "slot-2",
    task: "auction-marketplace/watch-lot/variant=drift", scenarioId: "auction-marketplace", verdict: "running",
    bundlePath: path.join(root, "test-runs", "run-abc"), repositoryRoot: "C:/repo",
  });
  assert.doesNotMatch(JSON.stringify(entry), /token|password|secret|key/iu, "the entry holds no credential field");
  const index = await readFile(path.join(root, "index.md"), "utf8");
  assert.match(index, /\| lane-b \| auction-marketplace\/watch-lot\/variant=drift \| running \| - \| 0 \|/u);
  assert.deepEqual(lines, []);
});

test("the lane falls back to the instance, then to default", async t => {
  const root = await scratch(t);
  const instance = await openRecord(root, { runId: "run-1", environment: { FLUXIQ_LAB_RUNS_DIR: root, FLUXIQ_LAB_INSTANCE: "slot-3" } });
  const neither = await openRecord(root, { runId: "run-2", environment: { FLUXIQ_LAB_RUNS_DIR: root } });
  const read = async (record: LabRunRecord) => JSON.parse(await readFile(path.join(record.folder, "entry.json"), "utf8")) as LabRunEntry;
  assert.deepEqual([(await read(instance.record)).lane, (await read(instance.record)).instance], ["slot-3", "slot-3"]);
  assert.deepEqual([(await read(neither.record)).lane, (await read(neither.record)).instance], ["default", "default"]);
});

test("close links the bundle's steps to the central steps, copies only the key files, and records the verdict, cost and steps", async t => {
  const root = await scratch(t);
  const bundle = path.join(root, "test-runs", "run-abc");
  const { record, lines } = await openRecord(root, { bundlePath: bundle });
  const steps = record.stepsDirectory!;
  // Core's steps, as it writes them during the run.
  for (const step of ["0001-decide", "0002-tool-core.run_node", "0003-judge"]) {
    await mkdir(path.join(steps, step), { recursive: true });
    await writeFile(path.join(steps, step, "meta.json"), "{}");
  }
  await writeFile(path.join(steps, "index.md"), "steps\n");
  // A finalized bundle: the key files and some that are not.
  const files: Record<string, string> = {
    "summary.json": "{\"verdict\":\"passed\"}", "run.json": "{}", "evaluation.json": "{}", "report.html": "<html></html>",
    "review/timeline.json": "[]", "review/contact-sheet.html": "<html></html>", "screenshots/0001.jpg": "jpeg",
    "snapshots/live-llm.json": JSON.stringify({ observed: { totalEstimatedCostUsd: 0.0123 } }), "snapshots/flow-lane.json": "{}",
    "logs/core.log": "core\n", "provider-failures.local.json": "{}",
    "events.ndjson": "{}\n", "snapshots/decision-trace.json": "{}", "logs/scenario-lab.log": "lab\n", "artifact-index.json": "{}",
  };
  for (const [relative, text] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(bundle, relative)), { recursive: true });
    await writeFile(path.join(bundle, relative), text);
  }

  await record.close({ verdict: "passed", bundlePath: bundle });
  assert.deepEqual(lines, []);

  // The junction reads as the central steps, and nothing is copied.
  assert.ok((await lstat(path.join(bundle, "steps"))).isSymbolicLink(), "the bundle's steps is a link");
  assert.deepEqual((await readdir(path.join(bundle, "steps"))).sort(), ["0001-decide", "0002-tool-core.run_node", "0003-judge", "index.md"]);
  assert.equal(await readFile(path.join(bundle, "steps", "0002-tool-core.run_node", "meta.json"), "utf8"), "{}");

  for (const relative of ["summary.json", "run.json", "evaluation.json", "report.html", "review/timeline.json", "review/contact-sheet.html", "screenshots/0001.jpg", "snapshots/live-llm.json", "snapshots/flow-lane.json", "logs/core.log", "provider-failures.local.json"]) {
    assert.equal(await readFile(path.join(record.folder, relative), "utf8"), files[relative], `${relative} was copied`);
  }
  for (const relative of ["events.ndjson", "snapshots/decision-trace.json", "logs/scenario-lab.log", "artifact-index.json"]) {
    await assert.rejects(lstat(path.join(record.folder, relative)), { code: "ENOENT" }, `${relative} is not a key file`);
  }

  const entry = JSON.parse(await readFile(path.join(record.folder, "entry.json"), "utf8")) as LabRunEntry;
  assert.equal(entry.verdict, "passed");
  assert.equal(entry.costUsd, 0.0123);
  assert.equal(entry.steps, 3);
  assert.ok(entry.finishedAt && !Number.isNaN(Date.parse(entry.finishedAt)));
  const index = await readFile(path.join(root, "index.md"), "utf8");
  const date = localDateTime(new Date(STARTED_AT)).date;
  assert.match(index, new RegExp(`\\| lane-b \\| auction-marketplace/watch-lot/variant=drift \\| passed \\| \\$0\\.0123 \\| 3 \\| \\[${date}/run-abc/\\]\\(${date}/run-abc/\\) \\|`, "u"));

  // Removing the bundle the way `pnpm task` does keeps the central steps.
  await rm(bundle, { recursive: true, force: true });
  assert.deepEqual((await readdir(steps)).sort(), ["0001-decide", "0002-tool-core.run_node", "0003-judge", "index.md"]);
});

test("close is best-effort and runs once: a missing bundle records the verdict, and a second close changes nothing", async t => {
  const root = await scratch(t);
  const { record, lines } = await openRecord(root);
  await record.close({ verdict: "failed", bundlePath: path.join(root, "no-such-bundle") });
  assert.equal(lines.length, 1, "the failed link is named once on the log");
  assert.match(lines[0]!, /could not link the bundle's steps/u);
  await record.close({ verdict: "passed" });
  const entry = JSON.parse(await readFile(path.join(record.folder, "entry.json"), "utf8")) as LabRunEntry;
  assert.deepEqual([entry.verdict, entry.costUsd, entry.steps], ["failed", null, 0]);
});

test("a record that cannot open says so, gives Core no step folder, and does nothing afterwards", async t => {
  const root = await scratch(t);
  const blocked = path.join(root, "a-file");
  await writeFile(blocked, "not a directory");
  const { record, lines } = await openRecord(blocked);
  assert.equal(record.stepsDirectory, undefined);
  assert.equal(lines.length, 1);
  assert.match(lines[0]!, /could not open the run's folder/u);
  record.watchSteps(async () => undefined);
  await record.close({ verdict: "passed" });
  assert.equal(lines.length, 1);
});
