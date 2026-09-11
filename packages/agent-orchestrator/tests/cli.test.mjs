import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { AppendOnlyAuditLog, createTaskPacket } from "../dist/index.js";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const cliPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist", "cli.js");

function command(cwd, args) { return { executable: "pnpm", args, cwd }; }

function request(repositoryRoot, allowedRoot) {
  return {
    taskId: "cli-repair", createdAt: "2026-09-04T12:00:00.000Z",
    humanTrigger: { requestedBy: "human", approvalReference: "approval-1" }, role: "extension-repair",
    objective: "Repair one bounded extension file.",
    scope: { repository: "facility", repositoryRoot, allowedRoots: [allowedRoot] },
    scenario: { id: "basic-form", seed: 42, command: command(repositoryRoot, ["lab", "run", "basic-form"]) },
    baseline: { runId: "baseline-1", artifactIndexSha256: HASH_A },
    failingInvariantIds: ["form.submitted"], protectedInvariants: [{ id: "form.submitted", definitionSha256: HASH_B, required: true }],
    budgets: { maxTurns: 5, maxRuns: 3, maxDurationMs: 60000, maxChangedFiles: 2, maxChangedBytes: 1000, maxTokens: 5000 },
    requiredChecks: [command(repositoryRoot, ["check"])],
  };
}

function response(packet, edit) {
  return {
    schemaVersion: "0.1", taskId: packet.taskId, status: "completed", summary: "Fixed.", hypotheses: [],
    changedFiles: [edit], checks: [{ command: packet.requiredChecks[0], status: "passed", exitCode: 0, evidenceReferences: ["check:1"] }],
    candidateRunIds: ["candidate-1"], evidenceReferences: ["run:candidate-1"], risks: [],
    usage: { turns: 2, runs: 1, durationMs: 1000, tokens: 500 },
  };
}

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "agent-orchestrator-cli-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const repositoryRoot = path.join(root, "workspace");
  const allowedRoot = path.join(repositoryRoot, "apps", "extension", "src");
  return { root, repositoryRoot, allowedRoot };
}

async function jsonFile(root, name, value) {
  const file = path.join(root, name);
  await writeFile(file, JSON.stringify(value), "utf8");
  return file;
}

function run(...args) {
  const result = spawnSync(process.execPath, [cliPath, ...args], { encoding: "utf8" });
  assert.equal(result.stderr, "");
  return { status: result.status, output: JSON.parse(result.stdout) };
}

test("CLI creates, validates, and renders a bounded packet as JSON", async (t) => {
  const { root, repositoryRoot, allowedRoot } = await fixture(t);
  const requestPath = await jsonFile(root, "request.json", request(repositoryRoot, allowedRoot));
  const result = run("task", "create", requestPath);
  assert.equal(result.status, 0);
  assert.equal(result.output.ok, true);
  assert.equal(result.output.packet.role, "extension-repair");
  assert.match(result.output.renderedMarkdown, /Human approval: human \(approval-1\)/);
});

test("CLI validates structured results against trusted observed edits and rejects scope escapes", async (t) => {
  const { root, repositoryRoot, allowedRoot } = await fixture(t);
  const packet = createTaskPacket(request(repositoryRoot, allowedRoot));
  const edit = { repository: "facility", path: path.join(allowedRoot, "content.ts"), operation: "modify", changedBytes: 20 };
  const [packetPath, responsePath, observedPath] = await Promise.all([
    jsonFile(root, "packet.json", packet), jsonFile(root, "response.json", response(packet, edit)), jsonFile(root, "observed.json", [edit]),
  ]);
  assert.equal(run("result", "validate", packetPath, responsePath, observedPath).status, 0);
  await writeFile(observedPath, JSON.stringify([{ ...edit, path: path.join(repositoryRoot, "domain", "escape.ts") }]), "utf8");
  const rejected = run("result", "validate", packetPath, responsePath, observedPath);
  assert.equal(rejected.status, 2);
  assert.equal(rejected.output.ok, false);
  assert.ok(rejected.output.issues.some(({ code }) => code === "scope.allowed-root"));
  assert.ok(rejected.output.issues.some(({ code }) => code === "edits.mismatch"));
});

test("CLI evaluates review gates without executing the candidate", async (t) => {
  const { root, repositoryRoot, allowedRoot } = await fixture(t);
  const packet = createTaskPacket(request(repositoryRoot, allowedRoot));
  const edit = { repository: "facility", path: path.join(allowedRoot, "content.ts"), operation: "modify", changedBytes: 20 };
  const invariant = (passed) => ({ id: "form.submitted", passed, expected: "true", actual: String(passed), evidenceSequences: [1] });
  const submission = {
    packet, response: response(packet, edit), observedEdits: [edit],
    baselineEvaluation: { schemaVersion: "0.1", runId: "baseline-1", verdict: "failed", invariants: [invariant(false)], metrics: {} },
    candidateEvaluation: { schemaVersion: "0.1", runId: "candidate-1", verdict: "passed", invariants: [invariant(true)], metrics: {} },
    comparison: { schemaVersion: "0.1", baselineRunId: "baseline-1", candidateRunId: "candidate-1", safetyPassed: true, expectationSetEqual: true, evidenceComplete: true, metricDeltas: {}, verdict: "improved", reasons: [] },
    candidateInvariants: packet.protectedInvariants, auditVerified: true,
  };
  const submissionPath = await jsonFile(root, "submission.json", submission);
  const result = run("review", "evaluate", submissionPath);
  assert.equal(result.status, 0);
  assert.equal(result.output.verdict, "approve-for-human-review");
});

test("CLI verifies an audit chain and fails closed after tampering", async (t) => {
  const { root } = await fixture(t);
  const auditPath = path.join(root, "audit.ndjson");
  const audit = new AppendOnlyAuditLog(auditPath, () => new Date("2026-09-04T12:00:00.000Z"));
  await audit.append({ event: "task.created", taskId: "cli-repair", actor: "human", payload: { approved: true } });
  assert.equal(run("audit", "verify", auditPath).status, 0);
  const text = await import("node:fs/promises").then(({ readFile }) => readFile(auditPath, "utf8"));
  await writeFile(auditPath, text.replace('"approved":true', '"approved":false'), "utf8");
  const rejected = run("audit", "verify", auditPath);
  assert.equal(rejected.status, 2);
  assert.ok(rejected.output.issues.some(({ code }) => code === "audit.invalid"));
});

test("worktree CLI requires isolated absolute roots and path-safety attestation, then emits argv only", async (t) => {
  const { root, repositoryRoot } = await fixture(t);
  const request = {
    schemaVersion: "0.1", taskId: "cli-repair", repositoryRoot, mainWorkspaceRoot: repositoryRoot,
    disposableBaseRoot: path.join(root, "disposable"), worktreeRoot: path.join(root, "disposable", "cli-repair"),
    branch: "agent/cli-repair", startPoint: "HEAD",
    pathSafety: { symlinksResolved: true, reparsePointsAbsent: true, verifiedBy: "coordinator", verifiedAt: "2026-09-04T12:00:00.000Z" },
  };
  const requestPath = await jsonFile(root, "worktree.json", request);
  const accepted = run("worktree", "plan", requestPath);
  assert.equal(accepted.status, 0);
  assert.deepEqual(accepted.output.plan.create.args, ["-C", repositoryRoot, "worktree", "add", "-b", "agent/cli-repair", request.worktreeRoot, "HEAD"]);
  assert.equal(typeof accepted.output.plan.create, "object");

  request.disposableBaseRoot = repositoryRoot;
  request.worktreeRoot = path.join(repositoryRoot, "candidate");
  request.pathSafety = undefined;
  await writeFile(requestPath, JSON.stringify(request), "utf8");
  const rejected = run("worktree", "plan", requestPath);
  assert.equal(rejected.status, 2);
  assert.ok(rejected.output.issues.some(({ code }) => code === "worktree.repository-overlap"));
  assert.ok(rejected.output.issues.some(({ code }) => code === "worktree.path-attestation"));
});

test("CLI returns machine-readable input errors with exit 1", async () => {
  const result = run("unknown", "command");
  assert.equal(result.status, 1);
  assert.equal(result.output.ok, false);
  assert.equal(result.output.issues[0].code, "input.invalid");
});
