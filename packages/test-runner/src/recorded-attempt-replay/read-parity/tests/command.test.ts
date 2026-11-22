import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { runRecordedReadCommand } from "../command.js";

test("recorded reader refuses unsupported sites and output outside ignored run scope before source/browser", async () => {
  const repositoryRoot = path.resolve("nonexistent-reader-repository");
  await assert.rejects(() => runRecordedReadCommand({ repositoryRoot, scenarioId: "basic-form", inputFile: "missing", outputFile: "missing" }), /ten realistic/u);
  await assert.rejects(() => runRecordedReadCommand({ repositoryRoot, scenarioId: "everything-store", inputFile: path.join(repositoryRoot, "test-runs", "input.json"), outputFile: path.resolve("outside-report.json") }), /run_scope_required/u);
});
