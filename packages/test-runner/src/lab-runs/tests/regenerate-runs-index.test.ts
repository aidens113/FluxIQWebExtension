import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { isProcessAlive, regenerateRunsIndex, type LabRunEntry } from "../index.js";

async function scratch(t: test.TestContext): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lab-runs-index-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function writeEntry(root: string, date: string, entry: Partial<LabRunEntry> & { runId: string }, steps = 0): Promise<void> {
  const folder = path.join(root, date, entry.runId);
  await mkdir(path.join(folder, "steps"), { recursive: true });
  for (let step = 1; step <= steps; step += 1) await mkdir(path.join(folder, "steps", `${String(step).padStart(4, "0")}-decide`));
  const full: LabRunEntry = { startedAt: `${date}T10:00:00.000Z`, pid: process.pid, lane: "lane-a", instance: "default", task: "s/t", scenarioId: "s", verdict: "running", bundlePath: "C:/runs/x", repositoryRoot: "C:/repo", ...entry };
  await writeFile(path.join(folder, "entry.json"), JSON.stringify(full));
}

/** The pid of a process that has exited. */
async function deadPid(): Promise<number> {
  const child = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
  const pid = child.pid!;
  await new Promise(resolve => child.once("exit", resolve));
  return pid;
}

test("rows are newest first, with cost, live step counts and a relative link", async t => {
  const root = await scratch(t);
  await writeEntry(root, "2026-09-30", { runId: "run-old", startedAt: "2026-09-30T08:00:00.000Z", verdict: "failed", costUsd: 0.5 }, 2);
  await writeEntry(root, "2026-10-01", { runId: "run-new", startedAt: "2026-10-01T09:00:00.000Z", verdict: "passed", costUsd: 0.25, task: "a|b" }, 4);
  await mkdir(path.join(root, "not-a-date", "run-x"), { recursive: true });
  await regenerateRunsIndex(root, { log: line => assert.fail(line) });
  const rows = (await readFile(path.join(root, "index.md"), "utf8")).split("\n").filter(line => line.startsWith("| ") && !line.startsWith("| Started") && !line.startsWith("| ---"));
  assert.equal(rows.length, 2);
  assert.match(rows[0]!, /\| a\\\|b \| passed \| \$0\.2500 \| 4 \| \[2026-10-01\/run-new\/\]\(2026-10-01\/run-new\/\) \|$/u);
  assert.match(rows[1]!, /\| failed \| \$0\.5000 \| 2 \| \[2026-09-30\/run-old\/\]/u);
  assert.deepEqual((await readdir(root)).filter(name => name.endsWith(".tmp") || name === ".index.lock"), [], "no temporary file or lock is left");
});

test("a run still running whose process has gone reads unfinished", async t => {
  const root = await scratch(t);
  await writeEntry(root, "2026-10-01", { runId: "run-dead", pid: await deadPid() });
  await writeEntry(root, "2026-10-01", { runId: "run-alive", pid: process.pid });
  await writeEntry(root, "2026-10-01", { runId: "run-done", pid: 1, verdict: "passed" });
  await regenerateRunsIndex(root);
  const index = await readFile(path.join(root, "index.md"), "utf8");
  assert.match(index, /\| unfinished \|[^\n]*run-dead/u);
  assert.match(index, /\| running \|[^\n]*run-alive/u);
  assert.match(index, /\| passed \|[^\n]*run-done/u);
  assert.equal(isProcessAlive(process.pid), true);
  assert.equal(isProcessAlive(0), false);
});

test("concurrent regenerations lose no row", async t => {
  const root = await scratch(t);
  const runs = Array.from({ length: 24 }, (_, index) => `run-${String(index).padStart(2, "0")}`);
  // Each run writes its entry and regenerates, all at once, as four lanes' starts and ends do.
  await Promise.all(runs.map(async runId => {
    await writeEntry(root, "2026-10-01", { runId, verdict: "passed" });
    await regenerateRunsIndex(root, { lock: { pollMs: 1 } });
  }));
  const index = await readFile(path.join(root, "index.md"), "utf8");
  for (const runId of runs) assert.ok(index.includes(`2026-10-01/${runId}/`), `${runId} has a row`);
});

test("a stale lock is taken over, and a live one is waited out only until the timeout", async t => {
  const root = await scratch(t);
  await writeEntry(root, "2026-10-01", { runId: "run-a", verdict: "passed" });
  const lock = path.join(root, ".index.lock");
  await mkdir(lock);
  const old = new Date(Date.now() - 60_000);
  await utimes(lock, old, old);
  await regenerateRunsIndex(root, { log: line => assert.fail(line) });
  assert.match(await readFile(path.join(root, "index.md"), "utf8"), /run-a/u);

  await mkdir(lock);
  const lines: string[] = [];
  await writeEntry(root, "2026-10-01", { runId: "run-b", verdict: "passed" });
  await regenerateRunsIndex(root, { log: line => lines.push(line), lock: { timeoutMs: 100, pollMs: 10 } });
  assert.match(await readFile(path.join(root, "index.md"), "utf8"), /run-b/u, "written anyway");
  assert.equal(lines.length, 1);
  assert.match(lines[0]!, /still held/u);
});

test("an entry that cannot be read is left out and named, and the rest are indexed", async t => {
  const root = await scratch(t);
  await writeEntry(root, "2026-10-01", { runId: "run-good", verdict: "passed" });
  await mkdir(path.join(root, "2026-10-01", "run-bad"), { recursive: true });
  await writeFile(path.join(root, "2026-10-01", "run-bad", "entry.json"), "{ not json");
  const lines: string[] = [];
  await regenerateRunsIndex(root, { log: line => lines.push(line) });
  const index = await readFile(path.join(root, "index.md"), "utf8");
  assert.match(index, /run-good/u);
  assert.doesNotMatch(index, /run-bad/u);
  assert.equal(lines.length, 1);
  assert.match(lines[0]!, /run-bad is left out of the index/u);
});
