import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import test from "node:test";
import { readRecordedReadSource } from "../source.js";

const identity = { scenarioId: "everything-store", projectId: "project.fixture", traceId: "trace.fixture", commandSequence: 89, resultSequence: 96, commandId: "command.fixture", callId: "read.fixture", primaryArtifactId: "artifact.fixture", primarySha256: "a".repeat(64), bindingSha256: "b".repeat(64), canonicalResultFile: "missing/0012-tool-core.run_node/result.json", canonicalResultSha256: "c".repeat(64) };

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
