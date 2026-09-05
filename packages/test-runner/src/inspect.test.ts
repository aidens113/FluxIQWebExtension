import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { sha256 } from "@fluxiq-web-extension/test-evidence";
import { inspectRun } from "./inspect.js";

test("inspect fails closed when an indexed artifact is tampered", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-inspect-"));
  try {
    const run = path.join(root, "run-a"); await mkdir(run); await writeFile(path.join(run, "run.json"), "tampered");
    const index = Buffer.from(JSON.stringify({ schemaVersion: "0.1", generatedAt: new Date().toISOString(), artifacts: [{ path: "run.json", mediaType: "application/json", bytes: 1, sha256: "0".repeat(64), redaction: "applied" }] }));
    await writeFile(path.join(run, "artifact-index.json"), index); await writeFile(path.join(run, "bundle.complete.json"), JSON.stringify({ schemaVersion: "0.1", artifactIndexSha256: sha256(index) }));
    await assert.rejects(inspectRun(root, "run-a"), /integrity validation failed/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
