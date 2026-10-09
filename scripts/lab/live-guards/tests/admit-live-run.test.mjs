// The guards end to end over real files: admission, the ledger lines around a
// run, the balance stop a run's own failure writes, reconciliation of a
// launcher that died, override files, and failing closed.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseRunnerRefusal } from "../../live-campaign/lab-run/index.mjs";
import { admitLiveRun, appendLedgerEntry, DEBUG_DIRECTORY, formatRefusals, readLedger, recordLiveRunFinish, recordLiveRunStart } from "../index.mjs";
import { INSUFFICIENT_BALANCE } from "./recorded-failures.mjs";

const ARGS = ["run", "bigbox-retail", "--live-llm", "--llm-task", "create-flow", "--instruction-task", "bigbox-retail-pickup-cart"];
const MINUTE = 60_000;
/** A run id as the runner names it: its start time in base 36, then 8 hex digits. */
const runIdAt = (ms, hex) => `run-${ms.toString(36)}-${hex}`;

/** Every checkout level with its dev; `behind-dev.test.mjs` reads real repositories. */
const level = async (root) => ({ root, head: "a".repeat(40), dev: "a".repeat(40), contains: true, lacking: 0, error: null });

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "live-guards-admit-"));
  const slots = path.join(directory, "lab-slots");
  const root = path.join(directory, "web");
  await mkdir(slots, { recursive: true });
  await mkdir(path.join(root, DEBUG_DIRECTORY), { recursive: true });
  const env = { FLUXIQ_LAB_INSTANCE: "slot-1" };
  const runs = path.join(root, "test-runs", "instances", "slot-1");
  let digest = "sha256:first";
  // Wednesday 12:00 UTC.
  let clock = Date.UTC(2026, 8, 30, 12, 0, 0);
  const admit = (overrides = {}) => admitLiveRun({ args: ARGS, env, repositoryRoot: root, coreRoot: path.join(directory, "core"), slotsDirectory: slots, now: clock, isAlive: () => true, fingerprint: async () => ({ digest, files: 1 }), devAncestry: level, ...overrides });
  const writeRun = async (runId, { startedAt, cost, failures, verdict = "failed", liveLlm = { observed: { totalEstimatedCostUsd: cost } } }) => {
    const run = path.join(runs, runId);
    await mkdir(path.join(run, "snapshots"), { recursive: true });
    await writeFile(path.join(run, "run.json"), JSON.stringify({ runId, startedAt, verdict }), "utf8");
    await writeFile(path.join(run, "snapshots", "live-llm.json"), JSON.stringify(liveLlm), "utf8");
    if (failures) await writeFile(path.join(run, "provider-failures.local.json"), JSON.stringify(failures), "utf8");
  };
  return {
    directory, slots, root, runs, admit, writeRun,
    setDigest: (value) => { digest = value; },
    advance: (ms) => { clock += ms; return clock; },
    now: () => clock,
    ledger: () => readLedger(path.join(slots, "spend-ledger.jsonl")),
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

test("a first live run is admitted from an empty lab-slots directory, admission writes nothing, and a run with no provider call is not guarded", async () => {
  const lab = await fixture();
  try {
    const admission = await lab.admit();
    assert.deepEqual(admission.refusals, []);
    assert.deepEqual(await lab.ledger(), []);
    assert.equal(await admitLiveRun({ args: ["run", "bigbox-retail"], env: {}, repositoryRoot: lab.root, coreRoot: lab.root, slotsDirectory: lab.slots }), null);
  } finally {
    await lab.cleanup();
  }
});

test("a run that ends on an empty balance is ledgered with its cost and stops every later live run", async () => {
  const lab = await fixture();
  try {
    const admission = await lab.admit();
    assert.deepEqual(admission.refusals, []);
    assert.equal(admission.launch.runsDirectory, lab.runs);
    const start = await recordLiveRunStart(admission, { now: lab.now(), pid: 4242 });
    lab.advance(20_000);
    const runId = runIdAt(lab.now() - 15_000, "9fa1dad7");
    await lab.writeRun(runId, { startedAt: new Date(lab.now() - 15_000).toISOString(), cost: 0.0123, failures: INSUFFICIENT_BALANCE });
    const { finishes, stopped } = await recordLiveRunFinish(admission, start, { exitCode: 1, now: lab.now() });
    assert.equal(finishes.length, 1);
    assert.equal(finishes[0].runId, runId);
    assert.equal(finishes[0].totalEstimatedCostUsd, 0.0123);
    assert.equal(finishes[0].verdict, "failed");
    assert.equal(finishes[0].fingerprint, "sha256:first");
    assert.equal(stopped, path.join(lab.slots, "STOP-balance"));
    assert.match(await readFile(stopped, "utf8"), /Insufficient Balance, HTTP 402.*\n[\s\S]*Only a person removes it/u);
    assert.deepEqual((await lab.ledger()).map((entry) => entry.event), ["start", "finish"]);

    lab.advance(MINUTE);
    const after = await lab.admit();
    assert.deepEqual(after.refusals.map((refusal) => refusal.rule), ["balance", "debug", "unchanged"]);
    // An override file cannot lift the balance stop.
    await writeFile(path.join(lab.slots, "OVERRIDE-balance"), "", "utf8");
    assert.equal((await lab.admit()).refusals[0].rule, "balance");
  } finally {
    await lab.cleanup();
  }
});

test("after the stop is cleared, a debug is written and the source changes, the next run is admitted", async () => {
  const lab = await fixture();
  try {
    const admission = await lab.admit();
    const start = await recordLiveRunStart(admission, { now: lab.now(), pid: 4242 });
    lab.advance(10_000);
    const runId = runIdAt(lab.now(), "00000001");
    await lab.writeRun(runId, { startedAt: new Date(lab.now()).toISOString(), cost: 0.05 });
    await recordLiveRunFinish(admission, start, { exitCode: 1, now: lab.now() });
    lab.advance(MINUTE);

    assert.deepEqual((await lab.admit()).refusals.map((refusal) => refusal.rule), ["debug", "unchanged"]);
    await writeFile(path.join(lab.root, DEBUG_DIRECTORY, `${runId}.md`), "# debug\n", "utf8");
    const undebuggedOnly = await lab.admit();
    assert.deepEqual(undebuggedOnly.refusals.map((refusal) => refusal.rule), ["unchanged"]);
    assert.match(undebuggedOnly.refusals[0].why, new RegExp(`${runId}, which ended failed`, "u"));

    await writeFile(path.join(lab.slots, "OVERRIDE-unchanged"), "", "utf8");
    const overridden = await lab.admit();
    assert.deepEqual(overridden.refusals, []);
    assert.deepEqual(overridden.overridden, ["unchanged"]);
    await rm(path.join(lab.slots, "OVERRIDE-unchanged"));

    lab.setDigest("sha256:second");
    assert.deepEqual((await lab.admit()).refusals, []);
  } finally {
    await lab.cleanup();
  }
});

test("the ledger records each run's spend per build against its ceiling, beside the run's total", async () => {
  const lab = await fixture();
  try {
    const admission = await lab.admit();
    const start = await recordLiveRunStart(admission, { now: lab.now(), pid: 4243 });
    lab.advance(20_000);
    const runId = runIdAt(lab.now() - 15_000, "0b1d0001");
    // A build and its repair at $0.20 each: $0.40 for the run, and no build past $0.25.
    const builds = [{ phase: "build", attempt: null, estimatedCostUsd: 0.2, overCeiling: false }, { phase: "runtime", attempt: null, estimatedCostUsd: 0.2, overCeiling: false }];
    const liveLlm = { authorized: { maxTotalEstimatedCostUsd: 0.25 }, observed: { totalEstimatedCostUsd: 0.4, perBuild: { ceilingUsd: 0.25, builds, maxBuildCostUsd: 0.2, overCeiling: 0 } } };
    await lab.writeRun(runId, { startedAt: new Date(lab.now() - 15_000).toISOString(), liveLlm });
    const { finishes } = await recordLiveRunFinish(admission, start, { exitCode: 0, now: lab.now() });
    assert.deepEqual([finishes[0].totalEstimatedCostUsd, finishes[0].buildCeilingUsd, finishes[0].maxBuildCostUsd, finishes[0].buildsOverCeiling], [0.4, 0.25, 0.2, 0]);
    const ledgered = (await lab.ledger()).find((entry) => entry.event === "finish");
    assert.deepEqual([ledgered.buildCeilingUsd, ledgered.maxBuildCostUsd, ledgered.buildsOverCeiling], [0.25, 0.2, 0]);
  } finally {
    await lab.cleanup();
  }
});

test("a run that recorded no ceiling is ledgered with its per-build fields unknown, never as within it", async () => {
  const lab = await fixture();
  try {
    const admission = await lab.admit();
    const start = await recordLiveRunStart(admission, { now: lab.now(), pid: 4244 });
    lab.advance(20_000);
    await lab.writeRun(runIdAt(lab.now() - 15_000, "0b1d0002"), { startedAt: new Date(lab.now() - 15_000).toISOString(), cost: 0.1 });
    const { finishes } = await recordLiveRunFinish(admission, start, { exitCode: 0, now: lab.now() });
    assert.deepEqual([finishes[0].totalEstimatedCostUsd, finishes[0].buildCeilingUsd, finishes[0].maxBuildCostUsd, finishes[0].buildsOverCeiling], [0.1, null, null, null]);
  } finally {
    await lab.cleanup();
  }
});

test("a launch whose launcher died is reconciled from its run directory before the next admission", async () => {
  const lab = await fixture();
  try {
    const admission = await lab.admit();
    await recordLiveRunStart(admission, { now: lab.now(), pid: 999_999 });
    const runId = runIdAt(lab.now() + 1000, "00000001");
    await lab.writeRun(runId, { startedAt: new Date(lab.now() + 1000).toISOString(), cost: 0.3 });
    lab.advance(10 * MINUTE);
    const next = await lab.admit({ isAlive: (pid) => pid !== 999_999 });
    const entries = await lab.ledger();
    assert.deepEqual(entries.map((entry) => entry.event), ["start", "finish"]);
    assert.equal(entries[1].reconciled, true);
    assert.equal(entries[1].runId, runId);
    assert.equal(entries[1].totalEstimatedCostUsd, 0.3);
    assert.deepEqual(next.refusals.map((refusal) => refusal.rule), ["debug", "unchanged"]);
    // A launcher still alive is left alone.
    await recordLiveRunStart(next, { now: lab.now(), pid: 1234 });
    await lab.admit({ isAlive: () => true });
    assert.equal((await lab.ledger()).length, 3);
  } finally {
    await lab.cleanup();
  }
});

test("a fourth start in 30 minutes on one instance is refused as a loop", async () => {
  const lab = await fixture();
  try {
    for (let index = 0; index < 3; index += 1) {
      await appendLedgerEntry(path.join(lab.slots, "spend-ledger.jsonl"), { event: "start", launchId: `launch-${index}`, at: new Date(lab.now() - (index + 1) * MINUTE).toISOString(), pid: 7, instance: "slot-1", scenarioId: "bigbox-retail", task: "t", fingerprint: "f", repositoryRoot: lab.root, runsDirectory: lab.runs, overridden: [] });
    }
    const refused = await lab.admit({ isAlive: () => true });
    assert.deepEqual(refused.refusals.map((refusal) => refusal.rule), ["loop"]);
  } finally {
    await lab.cleanup();
  }
});

test("a ledger that cannot be read fails the admission instead of admitting", async () => {
  const lab = await fixture();
  try {
    await writeFile(path.join(lab.slots, "spend-ledger.jsonl"), "not json\n", "utf8");
    await assert.rejects(lab.admit(), /not JSON/u);
    assert.equal(existsSync(path.join(lab.slots, "STOP-balance")), false);
  } finally {
    await lab.cleanup();
  }
});

test("a printed refusal names every rule and its remedy, and the campaign reads it as a run that never started", () => {
  const { text, line } = formatRefusals([
    { rule: "balance", overridable: false, why: "live runs are stopped", remedy: "top up, then delete STOP-balance" },
    { rule: "debug", overridable: true, why: "run-x has no debug file", remedy: "write it" },
  ]);
  assert.match(text, /rule "balance": live runs are stopped\.\n.*To satisfy it: top up/u);
  assert.match(text, /rule "debug"/u);
  assert.match(text, /cost nothing/u);
  const parsed = parseRunnerRefusal(`${text}${line}`);
  assert.equal(parsed.category, "lab.live-guard");
  assert.deepEqual(parsed.rules, ["balance", "debug"]);
  assert.equal(parsed.spentUsd, 0);
});
