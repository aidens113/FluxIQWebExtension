// Judging a created Flow by the records it stored. The recorded Flow lane pairs
// each dataset with a recorded extract step by the recording's order; a created
// Flow has no recording, so it is judged against the one extract step its task
// names, paired with the dataset that answers it (`pairingOrder`), through the
// same judgement and the same record comparison the recorded lane uses.

import type { ExpectedExtraction, ResolvedScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import { assertFlowExtraction, judgeFlowExtraction, type FlowExtractionJudgement } from "../expectations.js";
import { extractionReadsByNode } from "../extraction-read.js";
import type { PersistedFlowRunOutcome } from "../persisted-flow-run.js";
import type { FlowRunDataset } from "../run-datasets.js";

/**
 * The run's datasets against the expected dataset `stepId` names, which must
 * be an `extract` step of `workflow` (`resolveCreatedFlowRequest` has already
 * refused a task for which it is not). Never throws, so a run whose records
 * are wrong is still published with its measurement. The measurement keeps the
 * step's real position in the workflow's script.
 */
export function judgeCreatedFlowDataset(input: {
  workflow: ResolvedScenarioWorkflow;
  stepId: string;
  run: PersistedFlowRunOutcome;
  actionTypes: ReadonlyMap<string, string>;
  /** Where the run's scenario was served from, as `judgeFlowExtraction` takes it. */
  scenarioOrigin: string;
}): FlowExtractionJudgement {
  const stepIndex = input.workflow.recordingScript.findIndex((step) => step.operation === "extract" && step.id === input.stepId);
  const step = input.workflow.recordingScript[stepIndex];
  const expected = (input.workflow.expected.extracted ?? []).filter((entry) => entry.step === input.stepId);
  const pairing = pairingOrder(input.run.extracted, expected, executionOrder(input.run.actions));
  const judgement = judgeFlowExtraction({
    expected,
    script: step ? [step] : [],
    datasets: pairing.datasets,
    actionTypes: input.actionTypes,
    // **The dataset that answers the step, not the first one the Flow
    // stored** (`pairingOrder`).
    //
    // Before that it was the order the Flow's own nodes ran in, and before
    // that an empty map, which is not "no order" but an arbitrary one: on
    // `run-muhrf6c4-9714939f` the judged step measured **0** while Core's other
    // record set held the 8 records. First-run order fixed that and opened the
    // opposite hole (t195-w19a V1, t195-w19b #3): a correct Flow that reads a
    // list before its answer was judged on the list. confirm-requests reads the
    // request listing -- already the four expected records -- before any
    // Confirm, so a loop that confirmed nobody passed; pickup-order may read
    // the cart before the confirmation, so a right Flow failed.
    candidateOrder: pairing.candidateOrder,
    durationsByNode: input.run.extractionDurationsByNode,
    readsByNode: extractionReadsByNode(input.run.actions),
    scenarioOrigin: input.scenarioOrigin,
  });
  const steps = judgement.steps.map((judged) => ({ ...judged, stepIndex, measurement: { ...judged.measurement, stepIndex } }));
  return { ...judgement, steps, measurements: steps.map((judged) => judged.measurement) };
}

/**
 * The run's datasets in the order the expected step should be paired with
 * them, and a candidate order by node that keeps that order.
 *
 * First the datasets that carry the step's keys -- at least one record holding
 * every field the expected records name, less `optionalFields` -- the one
 * whose node ran **last** first: a Flow reads its answer after whatever it
 * read on the way there, and the answer is what the task asked to see. A
 * listing read again after the work (confirm-requests' accepted list) is the
 * later of two reads with the same keys, so "last" holds there too. A record
 * may carry no key the expectation does not name, so a candidate is not
 * required to carry nothing else: a listing with a `status` column is still a
 * candidate, and loses to the later answer only by running first.
 *
 * Then the rest, in the order their nodes first ran. With no candidate -- an
 * empty dataset has no keys, nor does an expectation without records -- this
 * is exactly that first-run order.
 */
function pairingOrder(
  datasets: readonly FlowRunDataset[],
  expected: readonly ExpectedExtraction[],
  ranAt: ReadonlyMap<string, number>,
): { datasets: FlowRunDataset[]; candidateOrder: ReadonlyMap<string, number> } {
  const keys = requiredKeys(expected);
  const position = (dataset: FlowRunDataset): number => Math.min(...dataset.nodeIds.map((nodeId) => ranAt.get(nodeId) ?? Number.POSITIVE_INFINITY), Number.POSITIVE_INFINITY);
  const carriesKeys = (dataset: FlowRunDataset): boolean => keys.length > 0 && dataset.records.some((record) => keys.every((key) => Object.hasOwn(record, key)));
  const candidates = datasets.filter(carriesKeys);
  const rest = datasets.filter((dataset) => !carriesKeys(dataset));
  // Latest first; a dataset whose node never ran is no evidence of being late.
  const latest = (dataset: FlowRunDataset): number => { const at = position(dataset); return Number.isFinite(at) ? at : Number.NEGATIVE_INFINITY; };
  const ordered = [...candidates.sort((left, right) => latest(right) - latest(left)), ...rest.sort((left, right) => position(left) - position(right))];
  // `judgeFlowExtraction` orders by node; a node keeps the position of the
  // first dataset it wrote here, and its stable sort keeps the rest as given.
  const candidateOrder = new Map<string, number>();
  ordered.forEach((dataset, index) => dataset.nodeIds.forEach((nodeId) => { if (!candidateOrder.has(nodeId)) candidateOrder.set(nodeId, index); }));
  return { datasets: ordered, candidateOrder };
}

/** Every field the step's expected records name, less those `optionalFields` lets an item lack. */
function requiredKeys(expected: readonly ExpectedExtraction[]): string[] {
  const keys = new Set<string>();
  for (const entry of expected) {
    const optional = new Set(entry.optionalFields ?? []);
    for (const record of entry.records ?? []) for (const key of Object.keys(record)) if (!optional.has(key)) keys.add(key);
  }
  return [...keys];
}

/**
 * Each node's position in the order its first attempt ran, for nodes that ran
 * at all.
 *
 * First attempt rather than last: a node the ladder retried ran where it first
 * ran, and a retry late in the run must not move its dataset behind one that
 * started after it.
 */
function executionOrder(actions: readonly { nodeId?: string | null }[]): ReadonlyMap<string, number> {
  const order = new Map<string, number>();
  for (const action of actions) {
    const nodeId = action.nodeId;
    if (typeof nodeId !== "string" || !nodeId || order.has(nodeId)) continue;
    order.set(nodeId, order.size);
  }
  return order;
}

/**
 * Fails a created Flow whose records do not match. A Flow with no extract node
 * fails first and as exactly that: it could not have collected anything, and
 * blaming a record count would hide why.
 */
export function assertCreatedFlowDataset(judgement: FlowExtractionJudgement): void {
  if (judgement.steps.length === 0 || judgement.expectation !== "judged") {
    throw new RunnerFailure("fixture.invalid", "The task's expected dataset names no expected extract step of its workflow, so nothing could be judged");
  }
  if (judgement.extractNodes === 0) {
    throw new RunnerFailure("runtime.behavior", "The created Flow has no extract node, so it could not collect the records the task asks for", { details: { extractNodes: 0 } });
  }
  assertFlowExtraction(judgement);
}

/** Whether the records matched, for the run's oracle verdict. */
export function createdFlowDatasetHolds(judgement: FlowExtractionJudgement): boolean {
  try { assertCreatedFlowDataset(judgement); return true; }
  catch { return false; }
}
