// `run-lab.mjs stop <instance>` stops exactly one Lab run: the instance's open
// launch in the spend ledger, by its recorded pid, and nothing else. No real
// process is killed here; the kill and the liveness check are injected.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { appendLedgerEntry, guardFiles, readLedger } from "../../live-guards/index.mjs";
import { findOpenLaunch, runStopCommand, stopLabRun } from "../index.mjs";

const NOW = Date.UTC(2026, 9, 6, 12, 0, 0);
const MINUTE = 60_000;

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lab-stop-run-"));
  const slots = path.join(directory, "lab-slots");
  const runs = path.join(directory, "runs");
  await mkdir(slots, { recursive: true });
  await mkdir(runs, { recursive: true });
  const files = guardFiles(slots);
  const alive = new Set();
  const killed = [];
  const start = (fields) => ({ event: "start", launchId: "launch-a", at: new Date(NOW - 5 * MINUTE).toISOString(), pid: 4100, instance: "slot-1", scenarioId: "bigbox-retail", task: "bigbox-retail/t", fingerprint: "f", repositoryRoot: directory, runsDirectory: runs, overridden: [], ...fields });
  const finish = (launchId) => ({ event: "finish", launchId, at: new Date(NOW - MINUTE).toISOString(), runId: null, instance: "slot-1", task: "bigbox-retail/t", verdict: null, totalEstimatedCostUsd: null, balanceFailure: null, fingerprint: "f", exitCode: 1 });
  const stop = (instance, overrides = {}) => stopLabRun({
    instance, slotsDirectory: slots, now: NOW,
    isAlive: (pid) => alive.has(pid),
    killTree: async (pid) => { killed.push(pid); alive.delete(pid); return { ok: true, detail: "killed" }; },
    sleep: async () => {},
    ...overrides,
  });
  return {
    directory, slots, files, alive, killed, start, finish, stop,
    append: (entry) => appendLedgerEntry(files.ledger, entry),
    ledger: () => readLedger(files.ledger),
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

test("the open launch is the instance's latest start with no finish; finished launches and other instances do not count", () => {
  const at = (minutesAgo) => new Date(NOW - minutesAgo * MINUTE).toISOString();
  const entries = [
    { event: "start", launchId: "old", at: at(30), pid: 1, instance: "slot-1" },
    { event: "start", launchId: "newer", at: at(10), pid: 2, instance: "slot-1" },
    { event: "start", launchId: "done", at: at(5), pid: 3, instance: "slot-1" },
    { event: "finish", launchId: "done", at: at(4) },
    { event: "start", launchId: "other", at: at(1), pid: 4, instance: "slot-2" },
  ];
  assert.equal(findOpenLaunch(entries, "slot-1").launchId, "newer");
  assert.equal(findOpenLaunch(entries, "slot-2").launchId, "other");
  assert.equal(findOpenLaunch(entries, "slot-3"), null);
});

test("stop kills only the open launch's pid tree, then closes the launch in the ledger", async () => {
  const lab = await fixture();
  try {
    await lab.append(lab.start({}));
    await lab.append(lab.start({ launchId: "launch-b", pid: 4200, instance: "slot-2" }));
    lab.alive.add(4100).add(4200);
    const result = await lab.stop("slot-1");
    assert.equal(result.status, "stopped");
    assert.deepEqual(lab.killed, [4100]);
    assert.ok(lab.alive.has(4200));
    assert.match(result.message, /4100/u);
    const finishes = (await lab.ledger()).filter((entry) => entry.event === "finish");
    assert.deepEqual(finishes.map((entry) => [entry.launchId, entry.reconciled]), [["launch-a", true]]);
  } finally {
    await lab.cleanup();
  }
});

test("stop refuses, killing nothing, when the instance has no open launch", async () => {
  const lab = await fixture();
  try {
    const empty = await lab.stop("slot-1");
    assert.equal(empty.status, "refused");
    assert.match(empty.message, /no open live run for instance slot-1/u);
    await lab.append(lab.start({}));
    await lab.append(lab.finish("launch-a"));
    lab.alive.add(4100);
    assert.equal((await lab.stop("slot-1")).status, "refused");
    assert.deepEqual(lab.killed, []);
  } finally {
    await lab.cleanup();
  }
});

test("stop refuses, killing nothing, when the recorded pid is gone or the start is too old to trust its pid", async () => {
  const lab = await fixture();
  try {
    await lab.append(lab.start({}));
    const gone = await lab.stop("slot-1");
    assert.equal(gone.status, "refused");
    assert.match(gone.message, /process 4100 is no longer running/u);
    await lab.append(lab.start({ launchId: "launch-stale", at: new Date(NOW - 7 * 60 * MINUTE).toISOString(), pid: 4300, instance: "slot-3" }));
    lab.alive.add(4300);
    const stale = await lab.stop("slot-3");
    assert.equal(stale.status, "refused");
    assert.match(stale.message, /older than/u);
    assert.deepEqual(lab.killed, []);
  } finally {
    await lab.cleanup();
  }
});

test("a kill that fails, or a process that survives it, is reported and the launch is left open", async () => {
  const lab = await fixture();
  try {
    await lab.append(lab.start({}));
    lab.alive.add(4100);
    const failed = await lab.stop("slot-1", { killTree: async () => ({ ok: false, detail: "Access is denied." }) });
    assert.equal(failed.status, "failed");
    assert.match(failed.message, /Access is denied/u);
    const survived = await lab.stop("slot-1", { killTree: async () => ({ ok: true, detail: "killed" }) });
    assert.equal(survived.status, "failed");
    assert.match(survived.message, /still running/u);
    assert.equal((await lab.ledger()).filter((entry) => entry.event === "finish").length, 0);
  } finally {
    await lab.cleanup();
  }
});

test("the command prints usage without an instance and exits 1 on a refusal, 0 on a stop", async () => {
  const lab = await fixture();
  try {
    let printed = "";
    const write = (text) => { printed += text; };
    const options = { slotsDirectory: lab.slots, now: NOW, isAlive: (pid) => lab.alive.has(pid), killTree: async (pid) => { lab.alive.delete(pid); return { ok: true, detail: "" }; }, sleep: async () => {}, write };
    assert.equal(await runStopCommand([], options), 1);
    assert.match(printed, /usage: node scripts\/lab\/run-lab\.mjs stop <instance>/u);
    printed = "";
    assert.equal(await runStopCommand(["slot-9"], options), 1);
    assert.match(printed, /"state":"refused"/u);
    await lab.append(lab.start({}));
    lab.alive.add(4100);
    assert.equal(await runStopCommand(["slot-1"], options), 0);
    assert.match(printed, /"state":"stopped"/u);
  } finally {
    await lab.cleanup();
  }
});
