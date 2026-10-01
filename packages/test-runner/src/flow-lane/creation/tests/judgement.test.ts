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
  return scenarioTask("product-catalog", taskId);
}

/** A live task's workflow and the expected records of the step it is judged by, from the scenario's own manifest. */
async function scenarioTask(scenarioId: string, taskId: string) {
  const request = await loadCreatedFlowRequest({ repositoryRoot, scenarioLabDist, scenarioId, taskId });
  const scenario = await loadScenarioManifest(repositoryRoot, scenarioId, scenarioLabDist);
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

/**
 * A run whose Flow had two extraction nodes: the first stored `records`, the
 * second stored nothing, and Core returned the empty one first.
 *
 * Core's dataset order is its own, so this is the shape the judge must not be
 * at the mercy of.
 */
function runStoringFromTwoNodes(records: readonly ExtractionRecord[]): PersistedFlowRunOutcome {
  return {
    ...runStoring(records),
    actions: [
      { actionType: "web.dom.extract_list", nodeId: "node.first", status: "succeeded", startedAt: "2026-09-26T00:00:00.000Z", failure: null },
      { actionType: "web.dom.extract_list", nodeId: "node.second", status: "succeeded", startedAt: "2026-09-26T00:00:20.000Z", failure: null }
    ] as PersistedFlowRunOutcome["actions"],
    extracted: [
      { datasetId: "dataset.second", nodeIds: ["node.second"], records: [], recordCount: 0, storeTruncated: false, invalidCount: 0, nonStringValues: 0, pages: 1 },
      { datasetId: "dataset.first", nodeIds: ["node.first"], records: [...records], recordCount: records.length, storeTruncated: false, invalidCount: 0, nonStringValues: 0, pages: 1 }
    ]
  };
}

test("a Flow with two extraction nodes is judged on the one that ran first, not on Core's dataset order", async () => {
  // **This scored a real run as returning nothing while its answer sat in the
  // other table.** `judgeCreatedFlowDataset` passed an empty candidate order,
  // and an empty order is not "no order" but an arbitrary one: every dataset
  // sorts to the same position, so `ordered[0]` is whichever set Core returned
  // first. On `run-muhrf6c4-9714939f` Core stored "8 records, across 2 record
  // sets", the judged step measured 0, and the 8 were in the other one.
  const { workflow, stepId, expected } = await catalogTask("product-catalog-first-page");
  const absolute = readAbsolutely(expected, scenarioOrigin);
  const judged = judgeCreatedFlowDataset({ workflow, stepId, run: runStoringFromTwoNodes(absolute), actionTypes, scenarioOrigin });
  const measured = judged.measurements[0]!;
  assert.deepEqual(
    [measured.observedRecords, measured.comparedRecords, measured.matchedRecords],
    [8, 8, 8],
    "the first extraction's dataset is the answer, although Core returned the empty one first"
  );
});

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

/**
 * A run whose Flow ran one extraction node per entry, in the order given, each
 * storing its entry's records; Core returns the datasets in reverse, so the
 * judge cannot lean on Core's order either.
 */
function runReading(reads: readonly { nodeId: string; records: readonly ExtractionRecord[] }[]): PersistedFlowRunOutcome {
  return {
    ...runStoring([]),
    actions: reads.map(({ nodeId }, index) => ({ actionType: "web.dom.extract_list", nodeId, status: "succeeded", startedAt: `2026-10-01T00:00:${String(index * 10).padStart(2, "0")}.000Z`, failure: null })) as PersistedFlowRunOutcome["actions"],
    extracted: [...reads].reverse().map(({ nodeId, records }) => ({ datasetId: `dataset.${nodeId}`, nodeIds: [nodeId], records: [...records], recordCount: records.length, storeTruncated: false, invalidCount: 0, nonStringValues: 0, pages: 1 })),
  };
}

const twoReads = new Map([["node.listing", "web.dom.extract_list"], ["node.answer", "web.dom.extract_list"]]);

test("confirm-requests: a listing read before the Confirms no longer passes a loop that confirmed too few; the later read is judged", async () => {
  // t195-w19a V1. The request listing already holds the four expected records,
  // so judging the first read passed whatever the loop then did. Here the loop
  // confirmed only three, which the accepted read, run last, shows.
  const { workflow, stepId, expected } = await scenarioTask("social-network-feed", "social-network-feed-confirm-requests");
  assert.equal(expected.length, 4);
  const run = runReading([{ nodeId: "node.listing", records: expected }, { nodeId: "node.answer", records: expected.slice(0, 3) }]);
  const judged = judgeCreatedFlowDataset({ workflow, stepId, run, actionTypes: twoReads, scenarioOrigin });
  assert.equal(judged.steps[0]?.dataset?.datasetId, "dataset.node.answer");
  assert.deepEqual([judged.measurements[0]?.observedRecords, judged.measurements[0]?.matchedRecords], [3, 3]);
  assert.equal(createdFlowDatasetHolds(judged), false);
});

test("confirm-requests: a listing with an extra column read first does not fail the right answer read after it", async () => {
  // t195-w19a V1, false fail: a record may carry no key the expectation does
  // not name, so the listing's `status` column failed a Flow whose accepted
  // read was exactly right.
  const { workflow, stepId, expected } = await scenarioTask("social-network-feed", "social-network-feed-confirm-requests");
  const listing = expected.map((record) => ({ ...record, status: "Pending" }));
  const run = runReading([{ nodeId: "node.listing", records: listing }, { nodeId: "node.answer", records: expected }]);
  const judged = judgeCreatedFlowDataset({ workflow, stepId, run, actionTypes: twoReads, scenarioOrigin });
  assert.equal(judged.steps[0]?.dataset?.datasetId, "dataset.node.answer");
  assert.equal(judged.measurements[0]?.matchedRecords, 4);
  assert.equal(createdFlowDatasetHolds(judged), true);
  assert.doesNotThrow(() => assertCreatedFlowDataset(judged));
});

test("pickup-order: a cart read before the order confirmation is passed over for the order record", async () => {
  // t195-w19b #3. The cart lines carry `name` and none of the order's keys.
  const { workflow, stepId, expected } = await scenarioTask("bigbox-retail", "bigbox-retail-pickup-order");
  assert.equal(expected.length, 1);
  const cart = [{ name: "ValueRidge Essentials Select-A-Size Paper Towels, 6 Double Rolls" }, { name: "Hand soap" }];
  const run = runReading([{ nodeId: "node.listing", records: cart }, { nodeId: "node.answer", records: expected }]);
  const judged = judgeCreatedFlowDataset({ workflow, stepId, run, actionTypes: twoReads, scenarioOrigin });
  assert.equal(judged.steps[0]?.dataset?.datasetId, "dataset.node.answer");
  assert.equal(judged.measurements[0]?.matchedRecords, 1);
  assert.equal(createdFlowDatasetHolds(judged), true);

  // The order record alone is judged as it always was.
  const alone = judgeCreatedFlowDataset({ workflow, stepId, run: runReading([{ nodeId: "node.answer", records: expected }]), actionTypes: twoReads, scenarioOrigin });
  assert.equal(createdFlowDatasetHolds(alone), true);
});

test("pickup-order: of two reads that both carry the order's keys, the later one is judged", async () => {
  const { workflow, stepId, expected } = await scenarioTask("bigbox-retail", "bigbox-retail-pickup-order");
  const stale = expected.map((record) => ({ ...record, total: "$0.00" }));
  const laterRight = judgeCreatedFlowDataset({ workflow, stepId, run: runReading([{ nodeId: "node.listing", records: stale }, { nodeId: "node.answer", records: expected }]), actionTypes: twoReads, scenarioOrigin });
  assert.equal(laterRight.steps[0]?.dataset?.datasetId, "dataset.node.answer");
  assert.equal(createdFlowDatasetHolds(laterRight), true);
  const laterWrong = judgeCreatedFlowDataset({ workflow, stepId, run: runReading([{ nodeId: "node.listing", records: expected }, { nodeId: "node.answer", records: stale }]), actionTypes: twoReads, scenarioOrigin });
  assert.equal(laterWrong.steps[0]?.dataset?.datasetId, "dataset.node.answer");
  assert.equal(createdFlowDatasetHolds(laterWrong), false);
});
