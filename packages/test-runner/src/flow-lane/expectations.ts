import type { AutomationStudioFailureRecord, ExpectedAction, ExpectedExtraction, ExpectedFailure, RunExtractionMeasurement, ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../failure.js";
import { assertExtraction, measureExtraction, type ExtractedValueContext, type ObservedExtraction } from "../run-expectations/index.js";
import type { FlowRunDataset } from "./run-datasets.js";
import type { PersistedFlowAction } from "./persisted-flow-run.js";

/**
 * Every `expected.actions` entry must match an attempt of that type. An entry
 * that declares an `outcome` must match an attempt with that status; an entry
 * with no `outcome` is judged on the attempt's presence alone, never as
 * `succeeded`. Reading a missing outcome as `succeeded` failed Lab Stage 2's
 * W15 `popup-blocked` and W26 `no-context`: each negative variant pins a click
 * with no outcome and names its failure in `expected.failure`, and Core failed
 * the click with exactly that failure.
 */
export function assertFlowActions(expected: readonly ExpectedAction[] | undefined, actions: readonly PersistedFlowAction[]): void {
  for (const entry of expected ?? []) {
    const { outcome } = entry;
    const matched = actions.some((action) => action.actionType === entry.action && (outcome === undefined || action.status === outcome));
    if (!matched) {
      // Action types and statuses are Core's own vocabulary, never page data,
      // so naming what did run is safe and is what makes this diagnosable.
      const observed = actions.map((action) => `${action.actionType}:${action.status}`);
      const wanted = outcome === undefined ? `a ${entry.action} action` : `a ${entry.action} action with outcome ${outcome}`;
      throw new RunnerFailure("action.dispatch", `The Flow did not produce ${wanted}; it produced ${observed.join(", ") || "no attempts"}`, {
        details: { expected: entry.action, ...(outcome === undefined ? {} : { expectedOutcome: outcome }), observed },
      });
    }
  }
}

/**
 * The run's structured failure against the workflow's `expected.failure`.
 * Both sides are Core's taxonomy and the observed side is Core's own
 * `failure` record, so nothing is inferred from a message. A workflow that
 * expects a failure and gets none fails; so does an unexpected failure, which
 * would otherwise let a broken run pass as long as it broke differently.
 *
 * The caller passes `null` for a failure the recovery ladder absorbed
 * (`absorbedEveryFailure`), which is not the same thing as a run that never
 * met one. Since t097 the run's own `failure` is already the failure that
 * decided it, so a caller that passes it directly is passing the same thing;
 * the absorbed ones are kept under `recoveredFailures`. Core records the first failure it meets and keeps the failed
 * attempt, so a node the retry rung rescued leaves a failure record on a run
 * whose status is `succeeded`; reading that as the run's outcome failed every
 * correct absorption. A workflow that *declares* a failure and then has it
 * absorbed still fails here, which is right: its declaration has gone stale.
 */
export function assertFlowFailure(expected: ExpectedFailure | undefined, failure: AutomationStudioFailureRecord | null): void {
  if (!expected) {
    if (failure) throw new RunnerFailure("runtime.behavior", `The Flow reported an unexpected ${failure.category} failure`, { details: { category: failure.category, ...(failure.code ? { code: failure.code } : {}) } });
    return;
  }
  if (!failure) {
    throw new RunnerFailure("runtime.behavior", `The Flow reported no structured failure, expected ${expected.category}`, { details: { expectedCategory: expected.category } });
  }
  if (failure.category !== expected.category) {
    throw new RunnerFailure("runtime.behavior", `The Flow reported failure category ${failure.category}, expected ${expected.category}`, { details: { expectedCategory: expected.category, actualCategory: failure.category } });
  }
  if (expected.code !== undefined && failure.code !== expected.code) {
    throw new RunnerFailure("runtime.behavior", `The Flow reported failure code ${String(failure.code)}, expected ${expected.code}`, { details: { expectedCode: expected.code, actualCode: failure.code ?? null } });
  }
}

/** The domain outputs whose nodes yield extracted records (`domain/src/actions/types.ts`). */
export const EXTRACT_OUTPUT_IDS: ReadonlySet<string> = new Set(["web.dom.extract", "web.dom.extract_list"]);

/**
 * The members of an `ExpectedExtraction` the Flow lane cannot observe, which
 * is what makes them unjudged here.
 *
 * Core's run detail carries an extract attempt's `metadata.recordCount` and
 * nothing else about the read: the rows go to the run dataset store, whose
 * summary states a record count, Core's own store truncation and its invalid
 * count — never how many pages the extraction followed, and never whether the
 * page's item cap cut it short. The dataset's `truncated` is Core dropping
 * rows past its per-run cap, a different event from the extraction reporting
 * itself truncated, so reading one as the other would be a false judgement
 * rather than a missing one.
 *
 * They are **named** rather than dropped: the judgement carries them per step,
 * the lane publishes them, and `paginationAccuracy` reports `rate: null` over
 * an empty population rather than a number. The entry's records are still
 * compared in full, which is the stronger claim in any case — a step that read
 * only its first page cannot produce the later pages' records.
 */
const LANE_UNOBSERVABLE: ReadonlyArray<{ member: "pages" | "truncated"; why: string }> = [
  { member: "pages", why: "Core's run detail and run datasets state no page count for an extraction" },
  { member: "truncated", why: "a run dataset's `truncated` is Core's own row cap, not the extraction's item cap" },
];

/**
 * Whether the Flow lane judges a workflow's `expected.extracted`:
 * `judged` when the workflow declares extraction, `not_expected` when it does
 * not.
 *
 * There is deliberately no third answer. Before X4 a recording's `extract`
 * step was the runner's own read rather than a user action, so Core proposed
 * no extract node and the lane published `not_applicable` — an expectation
 * quietly left unjudged on every paginated row. An `extract` step now records
 * a data-extraction action (`recordableActionTypes`), so a Flow short of an
 * extract node is a recording defect and fails as one.
 */
export type FlowExtractionExpectation = "judged" | "not_expected";

/** One extract step of the workflow, paired with the dataset the Flow's run stored for it. */
export type FlowExtractionStep = {
  /** The step's position in the workflow's recording script, from 0. */
  stepIndex: number;
  /** The step's id, which `expected.extracted` names. Fixture vocabulary, never page content. */
  stepId: string;
  /**
   * Every entry naming this step, `pages` and `truncated` removed; `[]` when
   * the workflow expects nothing of it. Every one of them is asserted; the
   * measurement is of the first, since a second entry for one step is a second
   * expectation of the same records rather than a second step.
   */
  entries: readonly ExpectedExtraction[];
  /** The dataset paired with this step by candidate order, absent when the run stored none for it. */
  dataset: FlowRunDataset | undefined;
  /** Members the entries declared that this lane cannot observe, by name. */
  unjudged: readonly string[];
  /** What the lane observed of this step, which the measurement and the assertion share. */
  observed: ObservedExtraction;
  measurement: RunExtractionMeasurement;
};

/**
 * What the Flow lane made of a workflow's extraction, computed before any
 * expectation is judged so a run that fails one is still published with its
 * measurements.
 */
export type FlowExtractionJudgement = {
  expectation: FlowExtractionExpectation;
  steps: readonly FlowExtractionStep[];
  /** One measurement per extract step of the script, in step order. */
  measurements: readonly RunExtractionMeasurement[];
  /** Nodes of the approved Flow that dispatch an extract output. */
  extractNodes: number;
  /** Datasets the run stored that no extract step claimed; a Flow that extracted more than the script did. */
  unpairedDatasets: number;
  /** Values the run's datasets carried that are not strings. Counts only (D6). */
  nonStringValues: number;
  /** Every step id the workflow's `expected.extracted` names, so an entry that pairs with no step is caught rather than dropped. */
  declaredSteps: readonly string[];
  /** The run's scenario origin, which the assertion compares against as the measurement did. Never published (`flowExtractionSnapshot`). */
  comparison: ExtractedValueContext;
};

/**
 * `expected.extracted` against the datasets Core stored for the Flow's run.
 *
 * Datasets pair with extract steps **by candidate order**: each dataset is
 * placed by the earliest position its writing nodes hold in the recording's
 * candidate order (`run-flow-lane.ts`, `recordedCandidateOrder`), and the
 * ordered datasets are zipped with the script's extract steps in script order.
 * Pairing by attempt index instead would mis-align the moment any other node
 * retries, and pairing by node id would read Core's ids into the judgement.
 *
 * One node reads every page of its own pagination, so a paginated step has one
 * dataset and not one per page — which is why a single `expected.extracted`
 * entry now matches a single dataset rather than an attempt per page.
 *
 * Nothing here throws: a judgement is evidence, and evidence a failing run
 * cannot publish is evidence nobody has when it is needed.
 */
export function judgeFlowExtraction(input: {
  expected: readonly ExpectedExtraction[] | undefined;
  /** The workflow's recording script, whose `extract` steps this pairs against. */
  script: readonly ScenarioStep[];
  datasets: readonly FlowRunDataset[];
  /** The approved Flow's node output ids (`flowActionTypes`). */
  actionTypes: ReadonlyMap<string, string>;
  /** Each action node's position in the recording's candidate order. */
  candidateOrder: ReadonlyMap<string, number>;
  /** Per-node extraction durations, summed from the run's attempts on that node. */
  durationsByNode: ReadonlyMap<string, number>;
  /** Where the run's scenario was served from: a root-relative expected URL resolves against it (`extractedValueMatches`). */
  scenarioOrigin: string;
}): FlowExtractionJudgement {
  const expected = input.expected ?? [];
  const comparison: ExtractedValueContext = { scenarioOrigin: input.scenarioOrigin };
  const extractSteps = input.script.flatMap((step, stepIndex) => (step.operation === "extract" ? [{ step, stepIndex }] : []));
  const ordered = orderDatasetsByCandidate(input.datasets, input.candidateOrder);
  const steps = extractSteps.map(({ step, stepIndex }, position): FlowExtractionStep => {
    const declared = expected.filter((entry) => entry.step === step.id);
    const dataset = ordered[position];
    const entries = declared.map(judgeableEntry);
    const observed = observedExtraction(dataset, input.durationsByNode);
    return {
      stepIndex, stepId: step.id, entries, dataset, observed,
      unjudged: [...new Set(declared.flatMap((entry) => LANE_UNOBSERVABLE.filter(({ member }) => entry[member] !== undefined).map(({ member }) => member)))],
      measurement: {
        stepIndex,
        status: declared.length === 0 ? "not_expected" : dataset === undefined ? "not_run" : "judged",
        // The **declared** entry, not the narrowed one: the measurement states
        // what the expectation asked for, including the pages this lane could
        // not observe, so `expectedPages` keeps one side of a comparison the
        // other side is missing. Narrowing is for the assertion alone.
        ...measureExtraction(declared[0], dataset?.records ?? [], observed, comparison),
      },
    };
  });
  return {
    expectation: expected.length === 0 ? "not_expected" : "judged",
    steps,
    measurements: steps.map((step) => step.measurement),
    extractNodes: [...input.actionTypes.values()].filter((outputId) => EXTRACT_OUTPUT_IDS.has(outputId)).length,
    unpairedDatasets: Math.max(0, ordered.length - extractSteps.length),
    nonStringValues: input.datasets.reduce((sum, dataset) => sum + dataset.nonStringValues, 0),
    declaredSteps: [...new Set(expected.map((entry) => entry.step))],
    comparison,
  };
}

/**
 * Judges what `judgeFlowExtraction` measured, once the run has published it.
 *
 * The order is deliberate. A Flow short of an extract node could not have run
 * the workflow's extraction at all, so it fails as a recording defect before
 * any record is compared and before a count is blamed for it. A value that is
 * not a string comes next, because a record missing a value it did carry could
 * otherwise match an expectation that omits the field (X0.7). Only then are
 * the records compared, step by step.
 */
export function assertFlowExtraction(judgement: FlowExtractionJudgement): void {
  if (judgement.expectation !== "judged") return;
  const { steps } = judgement;
  if (judgement.extractNodes < steps.length) {
    throw new RunnerFailure("recording.contract", `The approved Flow has ${judgement.extractNodes} extract node(s) for the workflow's ${steps.length} recorded extract step(s), so its extraction could not have run`, {
      details: { extractNodes: judgement.extractNodes, extractSteps: steps.length },
    });
  }
  if (judgement.nonStringValues > 0) {
    throw new RunnerFailure("runtime.behavior", `The Flow's extract attempts carried ${judgement.nonStringValues} field value(s) that are not strings`, { details: { nonStringValues: judgement.nonStringValues } });
  }
  const named = new Set(steps.map((step) => step.stepId));
  const unknown = [...new Set(judgement.declaredSteps.filter((stepId) => !named.has(stepId)))];
  if (unknown.length > 0) {
    // `checkExtractionReferences` already refuses this in a validated scenario;
    // it is re-checked because the alternative is an expectation that pairs
    // with no step and is therefore never judged at all.
    throw new RunnerFailure("fixture.invalid", `The workflow expects extraction from ${unknown.length} step(s) its recording script does not extract from`, { details: { steps: unknown } });
  }
  for (const step of steps) {
    if (step.entries.length === 0) continue;
    if (!step.dataset) {
      throw new RunnerFailure("runtime.behavior", `The Flow stored no extraction records for expected extract step ${step.stepId}`, {
        details: { stepId: step.stepId, stepIndex: step.stepIndex, expectedRecords: step.measurement.expectedRecords },
      });
    }
    assertExtraction(step.entries, step.stepId, step.dataset.records, step.observed, judgement.comparison);
  }
}

/**
 * What the lane observed of one step's extraction: its duration, and the
 * values its dataset could not carry. `pagesRead` and `truncated` are
 * deliberately absent — see `LANE_UNOBSERVABLE` — so the measurement reports
 * them as `null` instead of inventing them, and the entries handed to
 * `assertExtraction` never declare them.
 */
function observedExtraction(dataset: FlowRunDataset | undefined, durationsByNode: ReadonlyMap<string, number>): ObservedExtraction {
  if (!dataset) return { nonStringValues: 0 };
  const durationMs = dataset.nodeIds.reduce<number | undefined>((total, nodeId) => {
    const duration = durationsByNode.get(nodeId);
    return duration === undefined ? total : (total ?? 0) + duration;
  }, undefined);
  return { nonStringValues: dataset.nonStringValues, ...(durationMs === undefined ? {} : { durationMs }) };
}

/**
 * One entry with every member this lane cannot judge removed, so an
 * unobservable `pages` neither passes silently nor refuses the whole entry as
 * `fixture.invalid` (`assertExtraction`). The removal is reported on the step
 * as `unjudged`, and the metric built on it publishes no rate.
 */
function judgeableEntry(entry: ExpectedExtraction): ExpectedExtraction {
  const judgeable = { ...entry };
  for (const { member } of LANE_UNOBSERVABLE) delete judgeable[member];
  return judgeable;
}

/**
 * The datasets in the order their writing nodes appear in the recording. A
 * dataset whose nodes the order does not name sorts last, keeping Core's own
 * order among such datasets, so an unrecognised node moves no recognised
 * dataset off its step.
 */
function orderDatasetsByCandidate(datasets: readonly FlowRunDataset[], candidateOrder: ReadonlyMap<string, number>): FlowRunDataset[] {
  const position = (dataset: FlowRunDataset): number => Math.min(...dataset.nodeIds.map((nodeId) => candidateOrder.get(nodeId) ?? Number.POSITIVE_INFINITY), Number.POSITIVE_INFINITY);
  return [...datasets].sort((left, right) => position(left) - position(right));
}
