import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { FlowRunDataset } from "../../../flow-lane/index.js";
import type { ExtractionRecord } from "../../../run-expectations/index.js";
import { loadOracleExpectation } from "../oracle-expectation.js";
import { judgeTrialDatasets } from "../oracle-verdict.js";

// The social task's own oracle, from the Scenario Lab build the Lab judges by.
// Records are built from the expectation itself and only counts are asserted,
// so no page value is ever printed by a failing assertion.

// dist/offline-trial-experiment/oracle/tests -> repository root.
const repositoryRoot = fileURLToPath(new URL("../../../../../../", import.meta.url));
const task = { repositoryRoot, scenarioLabDist: path.join(repositoryRoot, "apps", "scenario-lab", "dist"), scenarioId: "social-network-feed", taskId: "social-network-feed-recent-group-posts", scenarioOrigin: "http://127.0.0.1:4731" };

function dataset(records: ExtractionRecord[]): FlowRunDataset {
  return { datasetId: "posts", nodeIds: ["node.read"], records, recordCount: records.length, storeTruncated: false, invalidCount: 0, nonStringValues: 0, pages: 1 };
}

test("the expected records themselves pass the task's oracle", async () => {
  const oracle = await loadOracleExpectation(task);
  assert.equal(oracle.stepId, "extract-recent-group-posts");
  const expected = oracle.entry.records ?? [];
  assert.ok(expected.length > 0);
  const verdict = judgeTrialDatasets(task, oracle, "run.pass", [dataset([...expected])]);
  assert.equal(verdict.passed, true);
  assert.equal(verdict.failure, null);
  assert.equal(verdict.matchedRecords, expected.length);
});

test("rows without the text column fail it, and so does a run whose read stored nothing", async () => {
  const oracle = await loadOracleExpectation(task);
  const expected = oracle.entry.records ?? [];
  const withoutText = expected.map((record) => Object.fromEntries(Object.entries(record).filter(([key]) => key !== "text")));
  const missing = judgeTrialDatasets(task, oracle, "run.no-text", [dataset(withoutText)]);
  assert.equal(missing.passed, false);
  assert.equal(missing.presentFields < missing.expectedFields, true);
  assert.match(missing.failure!.message, /carried no value for 1 required field/);
  const nothing = judgeTrialDatasets(task, oracle, "run.empty", [], 1);
  assert.equal(nothing.passed, false);
  assert.match(nothing.failure!.message, /stored no extraction records/);
  // Without the candidate's read count, the judgement can only say the Flow had no read at all.
  assert.match(judgeTrialDatasets(task, oracle, "run.empty", []).failure!.message, /no extract node/);
});
