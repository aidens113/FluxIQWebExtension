import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  AppendOnlyAuditLog,
  ROLE_POLICIES,
  createWorktreePlan,
  createTaskPacket,
  detectExpectationWeakening,
  evaluateReviewGate,
  isPathWithinRoot,
  readAuditLog,
  renderTaskMarkdown,
  validateCandidateEdits,
  validateTaskPacket,
  validateTaskResponse,
  validateWorktreePlanRequest,
  verifyAuditRecords,
} from "../dist/index.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const facilityRoot = "F:\\!FluxIQWebExtension";
const allowedRoot = `${facilityRoot}\\apps\\scenario-lab\\src\\scenarios\\basic-form`;

const command = (args) => ({ executable: "pnpm", args, cwd: facilityRoot });

function packet(overrides = {}) {
  return createTaskPacket({
    taskId: "repair-basic-form",
    createdAt: "2026-09-04T12:00:00.000Z",
    humanTrigger: { requestedBy: "human-reviewer", approvalReference: "request-42" },
    role: "scenario",
    objective: "Repair the deterministic basic form fixture.",
    scope: { repository: "facility", repositoryRoot: facilityRoot, allowedRoots: [allowedRoot] },
    scenario: { id: "basic-form", seed: 42, command: command(["lab", "run", "basic-form", "--seed", "42"]) },
    baseline: { runId: "baseline-1", artifactIndexSha256: HASH_A },
    failingInvariantIds: ["form.submitted"],
    protectedInvariants: [{ id: "form.submitted", definitionSha256: HASH_B, required: true }],
    budgets: { maxTurns: 8, maxRuns: 3, maxDurationMs: 600_000, maxChangedFiles: 4, maxChangedBytes: 20_000, maxTokens: 30_000 },
    requiredChecks: [command(["--filter", "scenario-lab", "test"])],
    ...overrides,
  });
}

function response(task, overrides = {}) {
  return {
    schemaVersion: "0.1",
    taskId: task.taskId,
    status: "completed",
    summary: "Corrected the deterministic fixture.",
    hypotheses: ["Fixture state was not reset."],
    changedFiles: [{ repository: "facility", path: `${allowedRoot}\\scenario.ts`, operation: "modify", changedBytes: 120 }],
    checks: [{ command: task.requiredChecks[0], status: "passed", exitCode: 0, evidenceReferences: ["run:candidate-1/check:1"] }],
    candidateRunIds: ["candidate-1"],
    evidenceReferences: ["run:candidate-1/event:9"],
    risks: [],
    usage: { turns: 3, runs: 2, durationMs: 120_000, tokens: 8_000 },
    ...overrides,
  };
}

const invariantResult = (passed, expected = "submitted=true") => ({ id: "form.submitted", passed, expected, actual: passed ? "submitted=true" : "submitted=false", evidenceSequences: [9] });

function submission(task = packet(), taskResponse = response(task)) {
  return {
    packet: task,
    response: taskResponse,
    observedEdits: taskResponse.changedFiles.map((edit) => ({ ...edit })),
    baselineEvaluation: { schemaVersion: "0.1", runId: "baseline-1", verdict: "failed", failureCategory: "fixture.invalid", invariants: [invariantResult(false)], metrics: { retries: 1 } },
    candidateEvaluation: { schemaVersion: "0.1", runId: "candidate-1", verdict: "passed", invariants: [invariantResult(true)], metrics: { retries: 0 } },
    comparison: { schemaVersion: "0.1", baselineRunId: "baseline-1", candidateRunId: "candidate-1", safetyPassed: true, expectationSetEqual: true, evidenceComplete: true, metricDeltas: { retries: -1 }, verdict: "improved", reasons: ["Invariant now passes"] },
    candidateInvariants: task.protectedInvariants,
    auditVerified: true,
  };
}

test("creates a human-triggered, bounded, vendor-neutral packet with mandatory prohibitions", () => {
  const task = packet();
  assert.equal(validateTaskPacket(task).accepted, true);
  assert.deepEqual(Object.values(ROLE_POLICIES).filter(({ writable }) => !writable).map(({ role }) => role), ["coordinator", "diagnosis", "reviewer"]);
  for (const action of ["merge", "publish", "deploy", "live-site-write", "disable-test", "weaken-expectation", "edit-outside-scope"]) assert.ok(task.prohibitedActions.includes(action));
  const rendered = renderTaskMarkdown(task);
  assert.match(rendered, /human-reviewer \(request-42\)/);
  assert.match(rendered, /\["pnpm","lab","run","basic-form","--seed","42"\]/);
  assert.equal(rendered.includes("&&"), false);
});

test("rejects malformed packets and missing human authorization", () => {
  const task = packet();
  task.humanTrigger.approvalReference = "";
  task.prohibitedActions = task.prohibitedActions.filter((item) => item !== "merge");
  task.failingInvariantIds.push("unknown-invariant");
  const result = validateTaskPacket(task);
  assert.equal(result.accepted, false);
  assert.ok(result.issues.some(({ code }) => code === "task.human-trigger"));
  assert.ok(result.issues.some(({ code }) => code === "prohibition.missing"));
  assert.ok(result.issues.some(({ code }) => code === "invariant.unknown-failure"));
});

test("enforces exact path roots, repository identity, role policy, and edit budgets", () => {
  const task = packet();
  assert.equal(isPathWithinRoot(`${allowedRoot}\\scenario.ts`, allowedRoot), true);
  assert.equal(isPathWithinRoot(`${allowedRoot}-evil\\scenario.ts`, allowedRoot), false);
  assert.equal(isPathWithinRoot(`${allowedRoot}\\..\\other\\scenario.ts`, allowedRoot), false);
  const edits = [
    { repository: "facility", path: `${allowedRoot}\\scenario.ts`, operation: "modify", changedBytes: 120 },
    { repository: "core", path: "F:\\!FluxIQ\\src\\runtime.ts", operation: "modify", changedBytes: 1 },
    { repository: "facility", path: `${allowedRoot}-evil\\scenario.ts`, operation: "modify", changedBytes: 1 },
  ];
  const result = validateCandidateEdits(task, edits);
  assert.equal(result.accepted, false);
  assert.ok(result.issues.some(({ code }) => code === "scope.repository"));
  assert.ok(result.issues.some(({ code }) => code === "scope.allowed-root"));
  const diagnosis = packet({ role: "diagnosis", scope: { repository: "facility", repositoryRoot: facilityRoot, allowedRoots: [] } });
  assert.ok(validateCandidateEdits(diagnosis, [edits[0]]).issues.some(({ code }) => code === "role.read-only"));
});

test("rejects expectation removal, mutation, and required-to-optional weakening", () => {
  const baseline = [{ id: "one", definitionSha256: HASH_A, required: true }, { id: "two", definitionSha256: HASH_B, required: true }];
  const candidate = [{ id: "one", definitionSha256: HASH_B, required: false }];
  const issues = detectExpectationWeakening(baseline, candidate);
  assert.deepEqual(new Set(issues.map(({ code }) => code)), new Set(["expectation.changed", "expectation.optional", "expectation.removed"]));
});

test("review gate approves only complete candidates for subsequent human review", () => {
  const accepted = evaluateReviewGate(submission());
  assert.equal(accepted.verdict, "approve-for-human-review");
  assert.equal(accepted.accepted, true);

  const rejectedSubmission = submission();
  rejectedSubmission.comparison.expectationSetEqual = false;
  rejectedSubmission.comparison.evidenceComplete = false;
  rejectedSubmission.candidateEvaluation.invariants[0].expected = "nothing required";
  rejectedSubmission.auditVerified = false;
  const rejected = evaluateReviewGate(rejectedSubmission);
  assert.equal(rejected.verdict, "reject");
  assert.ok(rejected.issues.some(({ code }) => code === "comparison.expectations"));
  assert.ok(rejected.issues.some(({ code }) => code === "comparison.evidence"));
  assert.ok(rejected.issues.some(({ code }) => code === "evaluation.expected-changed"));
  assert.ok(rejected.issues.some(({ code }) => code === "audit.invalid"));
});

test("requires every declared check to pass in a completed structured response", () => {
  const task = packet();
  const missing = validateTaskResponse(task, response(task, { checks: [] }));
  assert.equal(missing.accepted, false);
  assert.ok(missing.issues.some(({ code }) => code === "check.missing"));
  assert.ok(missing.issues.some(({ code }) => code === "check.not-passed"));
  const overBudget = validateTaskResponse(task, response(task, { usage: { turns: 9, runs: 4, durationMs: 700_000, tokens: 30_001 } }));
  assert.ok(overBudget.issues.filter(({ code }) => code === "budget.exceeded").length >= 4);
  const malformed = validateTaskResponse(task, { schemaVersion: "0.1", taskId: task.taskId, summary: "missing structured fields" });
  assert.equal(malformed.accepted, false);
  assert.ok(malformed.issues.some(({ code }) => code === "usage.missing"));
  assert.ok(malformed.issues.some(({ code }) => code === "response.checks"));
});

test("rejects role/repository mismatch and an agent-reported edit list that differs from the observed diff", () => {
  const wrongRepository = packet({ role: "core-repair" });
  assert.ok(validateTaskPacket(wrongRepository).issues.some(({ code }) => code === "role.repository"));
  const candidate = submission();
  candidate.response.changedFiles = [];
  const result = evaluateReviewGate(candidate);
  assert.equal(result.verdict, "reject");
  assert.ok(result.issues.some(({ code }) => code === "edits.mismatch"));
});

test("writes a serialized append-only hash chain and detects tampering", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "fluxiq-agent-audit-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const filePath = path.join(root, "audit.ndjson");
  let tick = 0;
  const log = new AppendOnlyAuditLog(filePath, () => new Date(1_700_000_000_000 + tick++ * 1000));
  await Promise.all([
    log.append({ event: "task.created", taskId: "task-1", actor: "human", payload: { approval: "request-42" } }),
    log.append({ event: "task.dispatched", taskId: "task-1", actor: "coordinator", payload: { role: "diagnosis" } }),
    log.append({ event: "response.received", taskId: "task-1", actor: "diagnosis-agent", payload: { status: "completed" } }),
  ]);
  const records = await readAuditLog(filePath);
  assert.equal(records.length, 3);
  assert.equal(verifyAuditRecords(records), true);
  records[1].payload.role = "core-repair";
  await writeFile(filePath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`);
  const tampered = await readAuditLog(filePath);
  assert.equal(verifyAuditRecords(tampered), false);
  await assert.rejects(() => log.append({ event: "review.completed", taskId: "task-1", actor: "reviewer", payload: {} }), /invalid audit chain/);
  assert.match(await readFile(filePath, "utf8"), /core-repair/);
});

test("refuses non-JSON audit payloads", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "fluxiq-agent-audit-json-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const log = new AppendOnlyAuditLog(path.join(root, "audit.ndjson"));
  await assert.rejects(() => log.append({ event: "task.created", taskId: "task-1", actor: "human", payload: { invalid: undefined } }), /JSON values/);
});

test("pure worktree planning rejects overlap, relative roots, unsafe refs, and missing path attestation", () => {
  const valid = {
    schemaVersion: "0.1", taskId: "task-1", repositoryRoot: "F:\\workspace", mainWorkspaceRoot: "F:\\workspace",
    disposableBaseRoot: "F:\\agent-worktrees", worktreeRoot: "F:\\agent-worktrees\\task-1",
    branch: "agent/task-1", startPoint: "HEAD",
    pathSafety: { symlinksResolved: true, reparsePointsAbsent: true, verifiedBy: "coordinator", verifiedAt: "2026-09-04T12:00:00.000Z" },
  };
  assert.equal(validateWorktreePlanRequest(valid).accepted, true);
  assert.equal(createWorktreePlan(valid).create.executable, "git");
  const invalid = { ...valid, disposableBaseRoot: "F:\\workspace\\tmp", worktreeRoot: "relative", branch: "agent/unsafe.lock", pathSafety: undefined };
  const issues = validateWorktreePlanRequest(invalid).issues;
  assert.ok(issues.some(({ code }) => code === "worktree.absolute"));
  assert.ok(issues.some(({ code }) => code === "worktree.repository-overlap"));
  assert.ok(issues.some(({ code }) => code === "worktree.branch"));
  assert.ok(issues.some(({ code }) => code === "worktree.path-attestation"));
});
