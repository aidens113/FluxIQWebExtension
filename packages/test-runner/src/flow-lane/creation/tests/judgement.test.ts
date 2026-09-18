import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolveScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { measureExtraction, type ExtractionRecord } from "../../../run-expectations/index.js";
import { loadScenarioManifest } from "../../../scenarios.js";
import type { PersistedFlowRunOutcome } from "../../persisted-flow-run.js";
import { assertCreatedFlowDataset, createdFlowDatasetHolds, judgeCreatedFlowDataset } from "../judgement.js";
import { loadCreatedFlowRequest } from "../request.js";

/**
 * The live catalog tasks judged against the Scenario Lab's own build, which is
 * what a campaign row is judged against. `run-mu4yk4u1-60a1c3a4` stored all 8
 * records of `product-catalog-first-page` with all 32 fields and matched none:
 * the created Flow read each link's absolute address, on that run's port,
 * while the fixture can only write the root-relative href.
 */

// dist/flow-lane/creation/tests -> repository root, independent of the working directory.
const repositoryRoot = fileURLToPath(new URL("../../../../../../", import.meta.url));
const scenarioLabDist = path.join(repositoryRoot, "apps", "scenario-lab", "dist");
const scenarioOrigin = "http://127.0.0.1:4731";
const actionTypes = new Map([["node.extract", "web.dom.extract_list"]]);

async function catalogTask(taskId: string) {
  const request = await loadCreatedFlowRequest({ repositoryRoot, scenarioLabDist, scenarioId: "product-catalog", taskId });
  const scenario = await loadScenarioManifest(repositoryRoot, "product-catalog", scenarioLabDist);
  const workflow = resolveScenarioWorkflow(scenario, { ...(request.workflowId === undefined ? {} : { workflowId: request.workflowId }), ...(request.variantId === undefined ? {} : { variantId: request.variantId }) });
  assert.equal(request.judgement.judgeBy, "expected-dataset");
  const stepId = request.judgement.judgeBy === "expected-dataset" ? request.judgement.stepId : "";
  const entry = workflow.expected.extracted?.find((candidate) => candidate.step === stepId);
  assert.ok(entry?.records, `${taskId} lists the records it expects`);
  return { workflow, stepId, entry, expected: entry.records };
}

/** A run that stored `records` in one dataset, from the Flow's one extract node. */
function runStoring(records: readonly ExtractionRecord[]): PersistedFlowRunOutcome {
  return {
    runId: "run.created", status: "succeeded", actions: [], failure: null, harnessActivations: 0, resultVerification: "confirmed",
    harnessRecovery: { attempted: false, interventions: [], runtimePatchAttempts: [], adaptationIds: [], changeProposalIds: [] },
    extracted: [{ datasetId: "dataset.created", nodeIds: ["node.extract"], records: [...records], recordCount: records.length, storeTruncated: false, invalidCount: 0, nonStringValues: 0, pages: 1 }],
    extractedNonStringValues: 0,
    extractionDurationsByNode: new Map(),
    route: null,
  };
}

/** Each record's `url` as a link's resolved address reads it: absolute, against `origin`. */
function readAbsolutely(records: readonly ExtractionRecord[], origin: string): ExtractionRecord[] {
  return records.map((record) => {
    assert.equal(typeof record.url, "string");
    return { ...record, url: new URL(record.url!, origin).href };
  });
}

test("product-catalog-first-page: a url column read absolutely on the run's origin matched 0 of 8 before, and matches 8 of 8", async () => {
  const { workflow, stepId, entry, expected } = await catalogTask("product-catalog-first-page");
  assert.equal(expected.length, 8);
  assert.ok(expected.every((record) => record.url?.startsWith("/scenarios/product-catalog/products/")), "the fixture writes the root-relative href");
  const absolute = readAbsolutely(expected, scenarioOrigin);
  assert.equal(absolute[0]?.url, `${scenarioOrigin}/scenarios/product-catalog/products/${expected[0]!.url!.split("/").at(-1)}`);

  // Before: the same record comparison with no origin to resolve against, which is how the judge compared.
  const before = measureExtraction(entry, absolute, { nonStringValues: 0 });
  assert.deepEqual([before.observedRecords, before.comparedRecords, before.matchedRecords, before.expectedFields, before.presentFields], [8, 8, 0, 32, 32], "the live run's measurement");

  const after = judgeCreatedFlowDataset({ workflow, stepId, run: runStoring(absolute), actionTypes, scenarioOrigin });
  const measured = after.measurements[0]!;
  assert.deepEqual([measured.status, measured.observedRecords, measured.comparedRecords, measured.matchedRecords, measured.expectedFields, measured.presentFields], ["judged", 8, 8, 8, 32, 32]);
  assert.equal(createdFlowDatasetHolds(after), true);
  assert.doesNotThrow(() => assertCreatedFlowDataset(after));

  // The raw href still matches, as it always did.
  const raw = judgeCreatedFlowDataset({ workflow, stepId, run: runStoring(expected), actionTypes, scenarioOrigin });
  assert.equal(raw.measurements[0]?.matchedRecords, 8);
  assert.equal(createdFlowDatasetHolds(raw), true);
});

test("product-catalog-first-page: an absolute url on any other origin still matches nothing", async () => {
  const { workflow, stepId, expected } = await catalogTask("product-catalog-first-page");
  for (const origin of ["http://127.0.0.1:4732", "http://localhost:4731", "https://catalog.example.test"]) {
    const judged = judgeCreatedFlowDataset({ workflow, stepId, run: runStoring(readAbsolutely(expected, origin)), actionTypes, scenarioOrigin });
    assert.equal(judged.measurements[0]?.matchedRecords, 0, origin);
    assert.equal(createdFlowDatasetHolds(judged), false, origin);
    assert.throws(() => assertCreatedFlowDataset(judged), /record 0 does not match/, origin);
  }
});

test("product-catalog-first-page-absolute-links: an expected absolute URL is compared exactly, as before", async () => {
  const { workflow, stepId, expected } = await catalogTask("product-catalog-first-page-absolute-links");
  assert.equal(expected.length, 8);
  assert.ok(expected.every((record) => record.url?.startsWith("https://catalog.example.test/scenarios/product-catalog/products/")), "the variant writes absolute links on a fixed origin");

  const asWritten = judgeCreatedFlowDataset({ workflow, stepId, run: runStoring(expected), actionTypes, scenarioOrigin });
  assert.equal(asWritten.measurements[0]?.matchedRecords, 8);
  assert.equal(createdFlowDatasetHolds(asWritten), true);

  // The same paths on the run's own origin, or root-relative, are not what this page wrote.
  const onRunOrigin = expected.map((record) => ({ ...record, url: `${scenarioOrigin}${new URL(record.url!).pathname}` }));
  const relative = expected.map((record) => ({ ...record, url: new URL(record.url!).pathname }));
  for (const records of [onRunOrigin, relative]) {
    const judged = judgeCreatedFlowDataset({ workflow, stepId, run: runStoring(records), actionTypes, scenarioOrigin });
    assert.equal(judged.measurements[0]?.matchedRecords, 0);
    assert.equal(createdFlowDatasetHolds(judged), false);
  }
});
