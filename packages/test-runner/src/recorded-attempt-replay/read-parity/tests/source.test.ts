import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import os from "node:os";
import test from "node:test";
import { readRecordedReadSource } from "../source.js";

const identity = { scenarioId: "everything-store", taskId: "everything-store-plus-earbuds-under-50", projectId: "project.fixture", traceId: "trace.fixture", commandSequence: 89, resultSequence: 96, commandId: "command.fixture", callId: "read.fixture", primaryArtifactId: "artifact.fixture", primarySha256: "a".repeat(64), bindingSha256: "b".repeat(64), canonicalResultFile: "missing/0012-tool-core.run_node/result.json", canonicalResultSha256: "c".repeat(64), runEntrySha256: "d".repeat(64) };

test("read source requires declared digests and an owned isolated copy before opening a host", async () => {
  await assert.rejects(() => readRecordedReadSource({ ...identity, repositoryRoot: "missing", sourceRootDir: "missing", primarySha256: "unknown" }), /digest_required/u);
  const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "recorded-read-source-"));
  try {
    await mkdir(path.join(repositoryRoot, "test-runs"));
    const outside = path.join(repositoryRoot, "outside");
    await mkdir(outside);
    await assert.rejects(() => readRecordedReadSource({ ...identity, repositoryRoot, sourceRootDir: outside }), /owned_copy_required/u);
  } finally { await rm(repositoryRoot, { recursive: true, force: true }); }
});

test("a contradictory original Lab receipt cannot be replaced by a synthetic-fixture assertion", async () => {
  const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "recorded-read-receipt-"));
  const sourceRootDir = path.join(repositoryRoot, "test-runs", "copy");
  const run = path.join(repositoryRoot, "recorded-run");
  const step = path.join(run, "steps", "0012-tool-core.run_node");
  const result = JSON.stringify({ read: { extracted: [{ value: "Synthetic" }] } });
  const entry = JSON.stringify({ runId: "recorded-run", scenarioId: "company-website", task: "different" });
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  try {
    await Promise.all([mkdir(sourceRootDir, { recursive: true }), mkdir(step, { recursive: true })]);
    await Promise.all([writeFile(path.join(step, "result.json"), result), writeFile(path.join(step, "meta.json"), JSON.stringify({ kind: "tool", toolId: "core.run_node", callId: identity.callId })), writeFile(path.join(run, "entry.json"), entry)]);
    await assert.rejects(() => readRecordedReadSource({ ...identity, repositoryRoot, sourceRootDir, canonicalResultFile: path.join(step, "result.json"), canonicalResultSha256: hash(result), runEntrySha256: hash(entry) }), /fixture_receipt_mismatch/u);
  } finally { await rm(repositoryRoot, { recursive: true, force: true }); }
});
