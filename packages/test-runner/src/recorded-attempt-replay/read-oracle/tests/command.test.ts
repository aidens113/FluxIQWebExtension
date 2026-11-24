import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import { runRecordedOracleCommand } from "../command.js";

test("the oracle proof refuses unsupported sites and files outside ignored run scope before any source or browser", async () => {
  const repositoryRoot = path.resolve("nonexistent-oracle-repository");
  await assert.rejects(() => runRecordedOracleCommand({ repositoryRoot, scenarioId: "basic-form", taskId: "basic-form-x", inputFile: "missing", outputFile: "missing" }), /ten realistic/u);
  await assert.rejects(() => runRecordedOracleCommand({ repositoryRoot, scenarioId: "everything-store", taskId: "everything-store-x", inputFile: path.join(repositoryRoot, "test-runs", "input.json"), outputFile: path.resolve("outside.json") }), /run_scope_required/u);
});

test("a self-declared fixture flag selects nothing, opens no browser and claims no model call", async () => {
  const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), "recorded-oracle-command-"));
  const directory = path.join(repositoryRoot, "test-runs", "oracle");
  try {
    await mkdir(directory, { recursive: true });
    const inputFile = path.join(directory, "input.json");
    const outputFile = path.join(directory, "report.json");
    await writeFile(inputFile, JSON.stringify({ provenance: "synthetic-fixture", scenarioId: "everything-store", taskId: "everything-store-other" }));
    const report = await runRecordedOracleCommand({ repositoryRoot, scenarioId: "everything-store", taskId: "everything-store-x", inputFile, outputFile });
    assert.equal(report.passed, false);
    assert.equal(report.gap, "recorded_oracle_fixture_provenance_required");
    assert.equal(report.modelCalls, 0);
    assert.equal(report.externalCalls, null);
    assert.equal(report.fullAttemptAccepted, false);
    assert.equal(JSON.parse(await readFile(outputFile, "utf8")).proof, "recorded_reads_oracle_table");
  } finally { await rm(repositoryRoot, { recursive: true, force: true }); }
});
