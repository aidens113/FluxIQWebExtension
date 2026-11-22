import assert from "node:assert/strict";
import test from "node:test";
import { ATTEMPT_REPORT_SCHEMA_VERSION, type AttemptSeries } from "@fluxiq-web-extension/test-contracts";
import { evaluateOfflineScoreboard, OFFLINE_SCOREBOARD_TASKS, type OfflineScoreboardEvidence } from "../index.js";

function evidence(): OfflineScoreboardEvidence {
  const task = OFFLINE_SCOREBOARD_TASKS[0];
  const rows: AttemptSeries["rows"] = [1, 2, 3, 4].map((attempt) => ({ schemaVersion: ATTEMPT_REPORT_SCHEMA_VERSION, taskId: task.taskId, scenarioId: task.scenarioId, attempt, path: attempt === 1 ? "explore" : "run_flow", calls: attempt === 1 ? 4 : 0, callKinds: { interpretation: attempt === 1 ? 1 : 0, judge: attempt === 1 ? 1 : 0, decisions: attempt === 1 ? 2 : 0 }, inputTokens: 10, outputTokens: 10, usd: 0.01, ms: 10, liveSteps: 1, simulation: "passed", answerVerdict: "right", oracleVerdict: "passed", flow: "replay_held", repeatedActs: [], loopsCaught: {}, standIns: ["model", "spend"], live: false }));
  const continuations = [2, 3, 4].map((toAttempt) => ({ fromAttempt: toAttempt - 1, toAttempt, held: true, refused: [] }));
  const source = { core: "core-test", extension: "extension-test" };
  return {
    source, proof: "full_attempt_series", oracleDigest: "a".repeat(64),
    series: { schemaVersion: ATTEMPT_REPORT_SCHEMA_VERSION, scenarioId: task.scenarioId, taskId: task.taskId, rows, firstRightAttempt: 1, attemptsUntilDeterministic: 1, spendDeltas: rows.slice(1).map((row) => ({ attempt: row.attempt, calls: row.attempt === 2 ? -4 : 0, tokens: 0, usd: 0, ms: 0, liveSteps: 0 })), continuations, deterministic: { asked: 3, ran: 3, attempts: rows.slice(1).map((row) => ({ attempt: row.attempt, path: row.path, flowId: "flow", continuationHeld: true, calls: 0, callKinds: row.callKinds!, ms: 10 })), zeroCallAttempts: 3, allHeld: true } },
    preflight: { scenarioId: task.scenarioId, source, stages: ["pairing", "chat_start", "person_answer", "permission_answer", "read"].map((stage) => ({ stage: stage as "pairing", passed: true, artifact: "synthetic-receipt" })), siteChallenge: "not_declared", externalCalls: 0, externalUsd: 0 },
    attempts: [1, 2, 3, 4].map((ordinal) => ({ ordinal, artifact: `attempt-${ordinal}.json`, savedFlow: "flow", savedDigest: `digest-${ordinal}`, startedFlow: ordinal > 1 ? "flow" : null, startedDigest: ordinal > 1 ? `digest-${ordinal - 1}` : null, logicalCalls: ordinal > 1 ? 0 : 4, externalCalls: 0, externalUsd: 0, historicalUsd: 0.03, modeledUsd: 0.01 })),
  };
}

const evaluate = (entry: OfflineScoreboardEvidence) => evaluateOfflineScoreboard({ source: entry.source, oracleDigests: { [entry.series.taskId]: "a".repeat(64) }, evidence: [entry] });

test("fixed ten-site scoreboard requires four right and three exact predecessor proofs", () => {
  const rows = evaluate(evidence());
  assert.equal(rows.length, 10);
  assert.equal(new Set(rows.map((row) => row.scenarioId)).size, 10);
  assert.equal(rows[0]!.verdict, "SUCCESS");
  assert.equal(rows[1]!.verdict, "FAILURE");
  assert.deepEqual(rows[1]!.reasons, ["missing_evidence"]);
});

test("old exit-zero series with later logical calls is PARTIAL", () => {
  const entry = evidence();
  entry.series.rows[1]!.calls = 1;
  entry.series.rows[1]!.callKinds!.judge = 1;
  assert.notEqual(evaluate(entry)[0]!.verdict, "SUCCESS");
});

test("unknown calls, copied Flow name without digest, prefix and stale preflight cannot pass", () => {
  const entry = evidence();
  const changes: OfflineScoreboardEvidence[] = [
    { ...entry, attempts: entry.attempts.map((attempt) => attempt.ordinal === 2 ? { ...attempt, logicalCalls: null } : attempt) },
    { ...entry, attempts: entry.attempts.map((attempt) => attempt.ordinal === 2 ? { ...attempt, startedDigest: "other-digest" } : attempt) },
    { ...entry, proof: "prefix" },
    { ...entry, preflight: { ...entry.preflight, source: { ...entry.source, core: "old-core" } } },
    { ...entry, oracleDigest: "d".repeat(64) },
  ];
  for (const changed of changes) assert.notEqual(evaluate(changed)[0]!.verdict, "SUCCESS");
});
