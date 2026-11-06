import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { AttemptReportRow } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../../failure.js";
import type { AttemptOutcome } from "../../driver.js";
import { AttemptProofStuck } from "../attempt/index.js";
import type { LiveAttemptEnded } from "../live-driver.js";
import { writeUnscoredAttemptEvidence } from "../unscored-attempt-evidence.js";

/** The ledger's own reader, as `paid-attempt-bundle.test.ts` loads it, so this cannot drift from what the ledger reads. */
const OUTCOMES = new URL("../../../../../../scripts/lab/live-guards/run-outcomes.mjs", import.meta.url);
type Outcome = { runId: string; verdict: string | null; totalEstimatedCostUsd: number | null };
const { readRunOutcomes } = await import(OUTCOMES.href) as { readRunOutcomes(directory: string, options: { sinceMs: number; knownRunIds: Set<string> }): Promise<Outcome[]> };

const THROWN = new RunnerFailure("runtime.behavior", "Core stored 4 record(s) for a run dataset and returned 28");

function ended(ordinal: number, usd: number): LiveAttemptEnded {
  return {
    ordinal,
    conversationId: "conversation.one",
    shown: null,
    site: { unread: "the site's state read failed" },
    outcome: {
      attempt: {
        taskId: "task.one", attemptId: `attempt.${ordinal}`, ordinal, projectId: "project.web", runId: "explore.one", path: "explore",
        status: "waiting_for_person", waitingFor: "stuck_in_a_loop",
        spend: { calls: 19, inputTokens: 1, outputTokens: 1, usd, ms: 694_000 }, budget: { usd: 5 }, liveSteps: 34, loopsCaught: {}, startedAtMs: 1,
      },
      result: { attemptId: `attempt.${ordinal}`, kind: "rows", rows: { runId: "explore.one", datasetId: "apprentices", totalRows: 4, truncated: false, columns: [] }, acts: [] },
    },
  };
}

async function world(t: test.TestContext): Promise<{ evidence: string; runs: string; steps: string; runId: string; startedAt: string; now: number }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-unscored-attempt-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const now = Date.now();
  const evidence = path.join(root, "attempts", "run");
  await mkdir(evidence, { recursive: true });
  return { evidence, runs: path.join(root, "runs"), steps: path.join(root, "steps"), runId: `run-${now.toString(36)}-0000abcd`, startedAt: new Date(now).toISOString(), now };
}

test("an attempt that ended before the run threw keeps its record, says why it was not scored, and reaches the ledger with its run, verdict and spend", async (t) => {
  const { evidence, runs, steps, runId, startedAt, now } = await world(t);
  const said = await writeUnscoredAttemptEvidence({
    evidence, attempts: 1, kept: new Map([[1, { ended: ended(1, 0.54), cache: { hitPercent: 69 }, modelCalls: null }]]), error: THROWN, recorded: false,
    paid: { runsDirectory: runs, runId, startedAt, plan: { maxTotalEstimatedCostUsd: 5 }, stepsDirectory: steps },
  });
  const record = JSON.parse(await readFile(path.join(evidence, "attempt.json"), "utf8")) as { notScored: unknown; attempt: { status: string }; result: { rows: { totalRows: number } } };
  assert.deepEqual(record.notScored, { name: "RunnerFailure", category: "runtime.behavior", message: THROWN.message });
  assert.equal(record.attempt.status, "waiting_for_person");
  assert.equal(record.result.rows.totalRows, 4);
  assert.match(await readFile(path.join(evidence, "attempt-report.txt"), "utf8"), /^Attempt 1 ended waiting_for_person for stuck_in_a_loop and was not scored: Core stored 4/u);
  const [outcome] = await readRunOutcomes(runs, { sinceMs: now, knownRunIds: new Set() });
  assert.equal(outcome?.runId, runId);
  assert.equal(outcome?.verdict, "failed");
  assert.equal(outcome?.totalEstimatedCostUsd, 0.54);
  assert.match(said, /1 attempt\(s\) ended and were kept unscored, with \$0\.5400 spent/u);
});

test("two attempts that ended are both kept, and the ledger has what both spent", async (t) => {
  const { evidence, runs, steps, runId, startedAt, now } = await world(t);
  await writeUnscoredAttemptEvidence({
    evidence, attempts: 2, kept: new Map([[2, { ended: ended(2, 0.25), cache: null, modelCalls: null }], [1, { ended: ended(1, 0.5), cache: null, modelCalls: null }]]), error: THROWN, recorded: false,
    paid: { runsDirectory: runs, runId, startedAt, plan: { maxTotalEstimatedCostUsd: 5 }, stepsDirectory: steps },
  });
  const record = JSON.parse(await readFile(path.join(evidence, "attempt.json"), "utf8")) as { attempts: { ordinal: number }[] };
  assert.deepEqual(record.attempts.map(({ ordinal }) => ordinal), [1, 2]);
  const [outcome] = await readRunOutcomes(runs, { sinceMs: now, knownRunIds: new Set() });
  assert.equal(outcome?.totalEstimatedCostUsd, 0.75);
});

test("a whole attempt record the run already wrote is left as it is", async (t) => {
  const { evidence } = await world(t);
  await writeFile(path.join(evidence, "attempt.json"), "{\"whole\":true}");
  await writeUnscoredAttemptEvidence({ evidence, attempts: 1, kept: new Map([[1, { ended: ended(1, 0.1), cache: null, modelCalls: null }]]), error: THROWN, recorded: true });
  assert.equal(await readFile(path.join(evidence, "attempt.json"), "utf8"), "{\"whole\":true}");
});

test("with no attempt ended there is nothing to keep and no spend to stand behind, so nothing is written", async (t) => {
  const { evidence, runs, steps, runId, startedAt, now } = await world(t);
  const said = await writeUnscoredAttemptEvidence({ evidence, attempts: 1, kept: new Map(), error: THROWN, recorded: false, paid: { runsDirectory: runs, runId, startedAt, plan: { maxTotalEstimatedCostUsd: 5 }, stepsDirectory: steps } });
  assert.equal(said, "no attempt had ended, so there was no attempt to keep");
  await assert.rejects(readFile(path.join(evidence, "attempt.json"), "utf8"));
  assert.deepEqual(await readRunOutcomes(runs, { sinceMs: now, knownRunIds: new Set() }), []);
});

test("a series whose second attempt never started keeps the first's verdict and the stuck reason, and the ledger has the run, a failed verdict and the spend of every call", async (t) => {
  const { evidence, runs, steps, runId, startedAt, now } = await world(t);
  const stuck = new AttemptProofStuck("the message started no attempt the thread can read, nothing moved for 600 s. The chat showed: \"Which of the two should I use?\"");
  const first = ended(1, 0.5);
  const outcome = { answer: { verdict: "right" }, startedFrom: null, record: first.outcome.attempt } as unknown as AttemptOutcome;
  const said = await writeUnscoredAttemptEvidence({
    evidence, attempts: 2, kept: new Map([[1, { ended: first, cache: null, modelCalls: null }]]), error: stuck, recorded: false,
    scored: new Map([[1, { outcome, row: { attempt: 1 } as unknown as AttemptReportRow }]]), didNotEnd: { ordinal: 2, attempt: null },
    paid: { runsDirectory: runs, runId, startedAt, plan: { maxTotalEstimatedCostUsd: 5 }, stepsDirectory: steps },
  });
  const record = JSON.parse(await readFile(path.join(evidence, "attempt.json"), "utf8")) as { didNotEnd: { ordinal: number; of: number; reason: { name: string; message: string } }; attempts: { ordinal: number; scored?: { answer: { verdict: string } }; notScored?: unknown }[] };
  assert.equal(record.attempts[0]?.scored?.answer.verdict, "right");
  assert.equal(record.attempts[0]?.notScored, undefined);
  assert.equal(record.didNotEnd.ordinal, 2);
  assert.equal(record.didNotEnd.reason.name, "AttemptProofStuck");
  assert.match(record.didNotEnd.reason.message, /Which of the two should I use/u);
  const report = await readFile(path.join(evidence, "attempt-report.txt"), "utf8");
  assert.match(report, /^Attempt 1 ended waiting_for_person for stuck_in_a_loop and was scored right\.$/mu);
  assert.match(report, /^Attempt 2 of 2 did not start: The proof stopped waiting: .*Which of the two/mu);
  const [ledger] = await readRunOutcomes(runs, { sinceMs: now, knownRunIds: new Set() });
  assert.equal(ledger?.runId, runId);
  assert.equal(ledger?.verdict, "failed");
  assert.equal(ledger?.totalEstimatedCostUsd, 0.5);
  assert.match(said, /attempt 2 did not start, with \$0\.5000 spent/u);
});

test("an attempt that stood unended when the follow gave up adds its spend so far to the ledger", async (t) => {
  const { evidence, runs, steps, runId, startedAt, now } = await world(t);
  const standing = { ...ended(2, 0.25).outcome.attempt, status: "working" as const };
  const first = ended(1, 0.5);
  await writeUnscoredAttemptEvidence({
    evidence, attempts: 2, kept: new Map([[1, { ended: first, cache: null, modelCalls: null }]]), error: new AttemptProofStuck("x"), recorded: false,
    didNotEnd: { ordinal: 2, attempt: standing }, paid: { runsDirectory: runs, runId, startedAt, plan: { maxTotalEstimatedCostUsd: 5 }, stepsDirectory: steps },
  });
  assert.match(await readFile(path.join(evidence, "attempt-report.txt"), "utf8"), /Attempt 2 of 2 did not end \(it stood at working/u);
  const [ledger] = await readRunOutcomes(runs, { sinceMs: now, knownRunIds: new Set() });
  assert.equal(ledger?.totalEstimatedCostUsd, 0.75);
});

test("a stuck first attempt with nothing ended still writes its record and the ledger's run", async (t) => {
  const { evidence, runs, steps, runId, startedAt, now } = await world(t);
  await writeUnscoredAttemptEvidence({ evidence, attempts: 1, kept: new Map(), error: new AttemptProofStuck("nothing moved"), recorded: false, didNotEnd: { ordinal: 1 }, paid: { runsDirectory: runs, runId, startedAt, plan: { maxTotalEstimatedCostUsd: 5 }, stepsDirectory: steps } });
  assert.match(await readFile(path.join(evidence, "attempt-report.txt"), "utf8"), /^Attempt 1 of 1 did not start: /u);
  const [ledger] = await readRunOutcomes(runs, { sinceMs: now, knownRunIds: new Set() });
  assert.equal(ledger?.runId, runId);
  assert.equal(ledger?.verdict, "failed");
});
