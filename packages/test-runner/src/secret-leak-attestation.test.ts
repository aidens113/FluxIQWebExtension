import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { attestWorkspaceSecretAbsence } from "./secret-leak-attestation.js";

const sentinel = "synthetic-deepseek-sentinel-123456789";

async function workspace(t: test.TestContext): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-secret-attestation-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("scans only approved text and skips bounded binary artifacts", async t => {
  const root = await workspace(t);
  await mkdir(path.join(root, "approved"), { recursive: true });
  await mkdir(path.join(root, "outside"), { recursive: true });
  await writeFile(path.join(root, "approved", "run.json"), JSON.stringify({ provider: "deepseek", status: "passed" }));
  await writeFile(path.join(root, "approved", "capture.png"), Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from(sentinel)]));
  await writeFile(path.join(root, "outside", "not-scanned.log"), sentinel);

  const report = await attestWorkspaceSecretAbsence({
    workspaceRoot: root, secretLiteral: sentinel, approvedRelativePaths: ["approved"],
  });
  assert.deepEqual(report, {
    status: "passed", scannedFiles: 1,
    scannedBytes: Buffer.byteLength(JSON.stringify({ provider: "deepseek", status: "passed" })),
    skippedBinaryFiles: 1, findingCount: 0, findings: [],
  });
});

test("finds a synthetic literal and credential syntax without returning content or the literal", async t => {
  const root = await workspace(t);
  await mkdir(path.join(root, "logs"), { recursive: true });
  const name = "event-" + sentinel + ".log";
  const matchingContent = [
    "prefix " + sentinel + " suffix",
    JSON.stringify({ password: "synthetic-password" }),
    "OPENAI_API_KEY=synthetic-value",
    "Authorization: Bearer synthetic-value",
  ].join("\n");
  await writeFile(path.join(root, "logs", name), matchingContent);

  const report = await attestWorkspaceSecretAbsence({
    workspaceRoot: root, secretLiteral: sentinel, approvedRelativePaths: ["logs"],
  });
  assert.equal(report.status, "failed");
  assert.equal(report.findingCount, 1);
  assert.deepEqual(report.findings[0]?.categories, [
    "authorization-material", "credential-assignment", "credential-field", "secret-literal",
  ]);
  assert.match(report.findings[0]?.path ?? "", /\[redacted\]/i);
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes(sentinel), false);
  assert.equal(serialized.includes(matchingContent), false);
  assert.equal("content" in (report.findings[0] ?? {}), false);
});

test("fails closed on missing, escaping, oversized, and excessive approved paths", async t => {
  const root = await workspace(t);
  await mkdir(path.join(root, "evidence"), { recursive: true });
  await writeFile(path.join(root, "evidence", "oversize.log"), "x".repeat(32));
  await writeFile(path.join(root, "evidence", "nul.log"), Buffer.from([65, 0, 66]));

  const report = await attestWorkspaceSecretAbsence({
    workspaceRoot: root,
    secretLiteral: sentinel,
    approvedRelativePaths: ["missing.log", "../outside.log", "evidence/oversize.log", "evidence/nul.log", "extra.log"],
    limits: { maxFileBytes: 8, maxTotalBytes: 8, maxApprovedPaths: 4 },
  });
  assert.equal(report.status, "failed");
  const categories = new Set(report.findings.flatMap(finding => finding.categories));
  assert.equal(categories.has("path-escape"), true);
  assert.equal(categories.has("unreadable-text"), true);
  assert.equal(categories.has("oversize-text"), true);
  assert.equal(categories.has("file-limit"), true);
  assert.equal(JSON.stringify(report).includes(sentinel), false);
});

test("rejects a reparse-point scope without following it", async t => {
  const root = await workspace(t);
  const outside = await mkdtemp(path.join(os.tmpdir(), "fluxiq-secret-outside-"));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(path.join(outside, "leak.log"), sentinel);
  const link = path.join(root, "linked");
  try {
    await symlink(outside, link, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error.code === "EPERM" || error.code === "EACCES")) {
      t.skip("symlink creation is unavailable");
      return;
    }
    throw error;
  }

  const report = await attestWorkspaceSecretAbsence({
    workspaceRoot: root, secretLiteral: sentinel, approvedRelativePaths: ["linked"],
  });
  assert.equal(report.status, "failed");
  assert.deepEqual(report.findings, [{ path: "linked", categories: ["unsafe-reparse"] }]);
  assert.equal(report.scannedFiles, 0);
});

test("rejects invalid inputs with fixed messages that contain no caller data", async () => {
  await assert.rejects(
    attestWorkspaceSecretAbsence({ workspaceRoot: "relative", secretLiteral: sentinel, approvedRelativePaths: ["logs"] }),
    error => error instanceof Error && error.message === "Secret attestation requires an absolute workspace root",
  );
  await assert.rejects(
    attestWorkspaceSecretAbsence({ workspaceRoot: path.resolve("."), secretLiteral: "short", approvedRelativePaths: ["logs"] }),
    error => error instanceof Error && error.message === "Secret attestation requires one bounded in-memory secret",
  );
});