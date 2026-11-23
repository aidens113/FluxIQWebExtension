import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import { runRecordedReadCommand } from "../command.js";

test("recorded reader refuses unsupported sites and output outside ignored run scope before source/browser", async () => {
  const repositoryRoot = path.resolve("nonexistent-reader-repository");
  await assert.rejects(() => runRecordedReadCommand({ repositoryRoot, scenarioId: "basic-form", inputFile: "missing", outputFile: "missing" }), /ten realistic/u);
  await assert.rejects(() => runRecordedReadCommand({ repositoryRoot, scenarioId: "everything-store", inputFile: path.join(repositoryRoot, "test-runs", "input.json"), outputFile: path.resolve("outside-report.json") }), /run_scope_required/u);
});

test("a self-declared fixture flag is not acceptance and unobserved network remains unknown", async () => {
  const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "recorded-read-command-"));
  const directory = path.join(repositoryRoot, "test-runs", "read");
  try {
    await mkdir(directory, { recursive: true });
    const inputFile = path.join(directory, "input.json");
    const outputFile = path.join(directory, "report.json");
    await writeFile(inputFile, JSON.stringify({ provenance: "synthetic-fixture", scenarioId: "everything-store" }));
    const result = await runRecordedReadCommand({ repositoryRoot, scenarioId: "everything-store", inputFile, outputFile });
    assert.equal(result.parityPassed, false);
    assert.equal(result.sourceVerified, false);
    assert.equal(result.providerCalls, 0);
    assert.equal(result.externalCalls, null);
    assert.equal(result.externalUsd, null);
    assert.equal(JSON.parse(await readFile(inputFile, "utf8")).provenance, "synthetic-fixture");
  } finally { await rm(repositoryRoot, { recursive: true, force: true }); }
});
