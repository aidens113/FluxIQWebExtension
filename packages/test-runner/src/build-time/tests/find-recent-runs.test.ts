import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { findRecentRuns } from "../index.js";

async function scratch(t: test.TestContext): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "build-time-runs-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function writeRun(root: string, date: string, runId: string, startedAt: string | null, steps: number): Promise<void> {
  const folder = path.join(root, date, runId);
  await mkdir(path.join(folder, "steps"), { recursive: true });
  for (let step = 1; step <= steps; step += 1) await mkdir(path.join(folder, "steps", `${String(step).padStart(4, "0")}-decide`));
  if (startedAt) await writeFile(path.join(folder, "entry.json"), JSON.stringify({ runId, startedAt, verdict: "failed", task: "s/t", lane: "bf-slot-1" }));
}

test("newest runs with steps first, by entry start, capped at the limit", async t => {
  const root = await scratch(t);
  await writeRun(root, "2026-10-18", "run-b", "2026-10-19T01:00:00.000Z", 2);
  await writeRun(root, "2026-10-19", "run-c", "2026-10-19T09:00:00.000Z", 1);
  await writeRun(root, "2026-10-19", "run-empty", "2026-10-19T10:00:00.000Z", 0);
  await writeRun(root, "2026-10-17", "run-a", null, 1);
  await writeFile(path.join(root, "index.md"), "# Lab runs\n");
  await mkdir(path.join(root, "not-a-date", "run-x", "steps", "0001-decide"), { recursive: true });
  const runs = await findRecentRuns(root, 10);
  assert.deepEqual(runs.map(run => run.runId), ["run-c", "run-b", "run-a"]);
  assert.equal(runs[2]!.verdict, "unknown");
  assert.equal(runs[0]!.lane, "bf-slot-1");
  assert.deepEqual((await findRecentRuns(root, 2)).map(run => run.runId), ["run-c", "run-b"]);
});
