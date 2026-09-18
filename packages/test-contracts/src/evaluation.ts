import type { RunAdaptationCost, RunAdaptationPersistence, RunAdaptationReuse, RunAdaptationValidation } from "./adaptation-reuse.js";
import type { AutomationStudioAdaptiveFailureClass } from "./failure-category.js";
import type { RunHarnessRecovery } from "./harness-recovery.js";
import type { LlmExecutionProfile } from "./llm.js";
import type { ExpectedFailure } from "./scenario.js";

/** Schema written by new `RunEvaluation` producers. 0.1 and 0.2 are read as 0.3 (`validateRunEvaluation`). */
export const EVALUATION_SCHEMA_VERSION = "0.3" as const;
/** Candidate comparisons did not change with the run-evaluation diagnostic. */
export const CANDIDATE_COMPARISON_SCHEMA_VERSION = "0.1" as const;

/**
 * The test-rig failure taxonomy: why the facility itself could not produce a
 * trustworthy run (fixture, environment, process, extension, gateway,
 * recording, evidence). It never describes how the automation failed; that is
 * `RunEvaluation.automationFailureReported`, in Core's failure taxonomy.
 */
export const failureCategories = [
  "fixture.invalid", "environment.missing", "process.startup", "extension.install", "extension.worker",
  "gateway.connection", "gateway.pairing", "recording.contract", "recording.persistence", "action.dispatch",
  "action.targeting", "runtime.behavior", "visual.mismatch", "performance.budget", "security.redaction",
  "test.flaky", "unknown",
] as const;
export type FailureCategory = (typeof failureCategories)[number];
export type InvariantResult = { id: string; passed: boolean; expected: string; actual: string; evidenceSequences: number[] };

export const facilityFailureBoundaries = ["finalized-bundle", "no-final-bundle"] as const;
export type FacilityFailureBoundary = (typeof facilityFailureBoundaries)[number];

export const facilityFailureStages = [
  "scenario.load", "bundle.initialize", "scenario.execute", "scenario.cleanup", "bundle.publish", "bench.persist",
] as const;
export type FacilityFailureStage = (typeof facilityFailureStages)[number];

export const facilityFailureReasons = [
  "readiness.timeout", "http.timeout", "http.abort", "http.transport",
  "module.missing", "path.missing", "path.denied", "unclassified",
] as const;
export type FacilityFailureReason = (typeof facilityFailureReasons)[number];

export const facilityFailureOperationStages = [
  "scenario.health", "core.health", "auth.login", "auth.session.validate",
  "project.create", "project.select", "control.request",
] as const;
export type FacilityFailureOperationStage = (typeof facilityFailureOperationStages)[number];

export const facilityFailureCauseCodes = [
  "ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND", "ERR_PACKAGE_PATH_NOT_EXPORTED",
  "ERR_PACKAGE_IMPORT_NOT_DEFINED", "ERR_UNSUPPORTED_DIR_IMPORT", "ENOENT", "EACCES", "EPERM",
  "ECONNREFUSED", "ECONNRESET", "EPIPE", "ETIMEDOUT", "ENETUNREACH", "EHOSTUNREACH",
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_SOCKET",
] as const;
export type FacilityFailureCauseCode = (typeof facilityFailureCauseCodes)[number];

/** Closed, bounded diagnostic for a test-facility failure; never raw error data. */
export type FacilityFailureDiagnostic = {
  boundary: FacilityFailureBoundary;
  stage: FacilityFailureStage;
  reason: FacilityFailureReason;
  operationStage?: FacilityFailureOperationStage;
  causeCode?: FacilityFailureCauseCode;
  timeoutMs?: number;
};

/**
 * Lanes a run evaluation comes from. `recording`: the Testing Lab drives the
 * scenario script while the extension records. `flow`: FluxIQ runs a Flow
 * created from that recording (proposal, then approval).
 */
export const evaluationLanes = ["recording", "flow"] as const;
export type EvaluationLane = (typeof evaluationLanes)[number];

/** One executed action: its FluxIQ action type and how long it took. */
export type RunActionLatency = { actionType: string; durationMs: number };

/** Evidence a run produced: bytes per sanitized packet and per raw snapshot, and how many were truncated. */
export type RunEvidenceSizes = { sanitizedPacketBytes: number[]; rawSnapshotBytes: number[]; truncationCount: number };

/** No provider configured, or the mode of the `LlmExecutionProfile` in use. */
export const llmUsageModes = ["disabled", "deterministic-dry", "live"] as const satisfies readonly ("disabled" | LlmExecutionProfile["mode"])[];
export type LlmUsageMode = (typeof llmUsageModes)[number];

/**
 * The LLM configuration a run or bench used and the provider calls it made.
 * Week 1 runs provider-free: `{ mode: "disabled", profileId: null, calls: 0 }`.
 */
export type LlmUsage = { mode: LlmUsageMode; profileId: string | null; calls: number };

/**
 * Whether an extraction step's records were judged against the workflow's
 * expectation (`judged`), the step was expected but never ran (`not_run`), or
 * the step ran with no expectation to judge it by (`not_expected`).
 */
export const extractionMeasurementStatuses = ["judged", "not_run", "not_expected"] as const;
export type ExtractionMeasurementStatus = (typeof extractionMeasurementStatuses)[number];

/**
 * The members of an `ExpectedExtraction` a run can declare and then not judge,
 * because nothing in that run reported the value they would be compared
 * against.
 *
 * They are a closed vocabulary rather than free text for the reason `status`
 * is: a measurement carries no string a page could have supplied (D6), and a
 * name from this list cannot be one.
 */
export const extractionUnjudgedMembers = ["pages", "truncated"] as const;
export type ExtractionUnjudgedMember = (typeof extractionUnjudgedMembers)[number];

/**
 * One extraction step of a run, measured. **Counts and flags only** (D6): no
 * step id, field name, selector, or page value ever enters it, so an
 * evaluation can be shared without carrying what a page showed. `status` and
 * `unjudged` are the only strings, and both are closed vocabularies.
 *
 * `recordsListed`, `countStated`, and `comparedRecords` say what the step's
 * numbers are worth, and no reader of `matchedRecords` may skip them. An
 * expectation that lists records is the only one whose values are compared; an
 * expectation that states a count alone compares **nothing**, and one that
 * states neither judges nothing at all. A count-only step therefore reports
 * `comparedRecords: 0` and `matchedRecords: 0` -- it counted records, it did
 * not judge them -- and a pooled record accuracy must exclude it rather than
 * score it a perfect match for values no one looked at.
 *
 * `matchedRecords` never exceeds `comparedRecords`, which never exceeds
 * `expectedRecords` or `observedRecords`, and `presentFields` never exceeds
 * `expectedFields`. `pagesFollowed`, `truncated`, and `durationMs` are `null`
 * when the step did not report them.
 */
export type RunExtractionMeasurement = {
  /** The step's position in the workflow's script, from 0. */
  stepIndex: number;
  status: ExtractionMeasurementStatus;
  /**
   * The records the expectation required: the number it listed, else the count
   * it stated, else -- with neither stated -- the number observed, which
   * judges nothing and is why `countStated` exists.
   */
  expectedRecords: number;
  observedRecords: number;
  /** Whether the expectation listed the records themselves, the only thing that lets a value be compared. */
  recordsListed: boolean;
  /** Whether the expectation stated a record count of its own, rather than `expectedRecords` being adopted from what the step observed. */
  countStated: boolean;
  /** Record positions whose values were compared: `min(expectedRecords, observedRecords)` when `recordsListed`, 0 otherwise. */
  comparedRecords: number;
  /** Compared records equal to the expected record at their position, so 0 whenever `comparedRecords` is 0. */
  matchedRecords: number;
  /**
   * Expected records equal to **some** observed record when position is set
   * aside, each observed record answering at most one expected one.
   *
   * It exists because `matchedRecords` alone cannot tell a wrong answer from a
   * right answer in the wrong order, and those are different defects with
   * different fixes. `company-directory-logistics-sector` returned 40 records
   * and matched 35, and nothing in the run said whether five companies were
   * read wrongly or forty were read rightly and five moved. This is that
   * missing half of the comparison: equal to `matchedRecords` when order is
   * not the difference, and larger by exactly the records that only moved.
   *
   * The verdict stays positional (`assertExtraction`). This is measured beside
   * it, never instead of it: an expectation that lists records lists them in
   * the page's order, and a fixture that means "the ten newest homes" means
   * the order too.
   *
   * It never exceeds `comparedRecords` and is never below `matchedRecords`: a
   * match at its own position is a match in any order. `null` when the
   * producer did not measure it, as in every evaluation written before it was
   * defined.
   */
  matchedInAnyOrder: number | null;
  /**
   * Members the expectation declared that this run reported nothing for, so
   * they were declared and **not judged** -- `[]` when everything declared was
   * judged, and `null` when the producer did not state it.
   *
   * A declared expectation that is quietly skipped is worse than one that was
   * never written, because the evaluation reads as a full judgement. The Flow
   * lane cannot observe the pages an extraction followed, so a fixture
   * declaring `pages: 3` had that expectation dropped and said so nowhere in
   * `evaluation.json`: `expectedPages: 3` with `pagesFollowed: null` is the
   * same shape as a lane that simply did not report, and a reader could not
   * tell "not compared" from "not stated".
   */
  unjudged: ExtractionUnjudgedMember[] | null;
  expectedFields: number;
  /** Expected fields the observed records carried. */
  presentFields: number;
  /** Fields the observed records carried that the expectation does not name. */
  unexpectedFields: number;
  /**
   * The pages the expectation declared, `null` when it declared none.
   *
   * It is stated because a pagination accuracy is a comparison, and a
   * measurement carrying only `pagesFollowed` cannot be compared against
   * anything: pooling it would either invent an expectation or score a step
   * for agreeing with itself. A step enters `paginationAccuracy` only when
   * both this and `pagesFollowed` are stated; a lane that cannot observe the
   * pages a read covered leaves `pagesFollowed` null, and the step enters no
   * rate rather than a flattering one.
   */
  expectedPages: number | null;
  pagesFollowed: number | null;
  truncated: boolean | null;
  durationMs: number | null;
  /** Observed field values that were not strings. */
  nonStringValues: number;
};
/**
 * One run's evaluation. `verdict`, `failureCategory`, `invariants`, and
 * `metrics` judge the run as a test; every later field is a per-run
 * measurement the Week 1 Metrics table aggregates into a `BenchReport`.
 *
 * Two failure fields that must not be confused:
 * - `failureCategory` is the test-rig taxonomy (`failureCategories`): the
 *   facility failed, so the run says nothing about the automation.
 * - `automationFailureReported` is the failure FluxIQ reported for the
 *   automation (`AutomationStudioAdaptiveFailureClass`), and `automationFailureExpected`
 *   is the resolved workflow's `expected.failure`. Failure classification
 *   accuracy compares their categories.
 *
 * False failure is `oracleVerdict: "passed"` with `reportedVerdict: "failed"`;
 * false success is the inverse. A `reportedVerdict` of `unverified` is neither:
 * FluxIQ reported no judgement of the result at all.
 */
export type RunEvaluation = {
  schemaVersion: typeof EVALUATION_SCHEMA_VERSION;
  runId: string;
  verdict: "passed" | "failed" | "inconclusive";
  /** Test-rig failure only; see the type comment. */
  failureCategory?: FailureCategory;
  /** Sanitized facility diagnostic, or `null` when the facility itself did not fail. */
  facilityFailure: FacilityFailureDiagnostic | null;
  invariants: InvariantResult[];
  metrics: Record<string, number>;
  scenarioId: string;
  /** `null` for the manifest's primary workflow. */
  workflowId: string | null;
  /** `null` when no variant was armed. */
  variantId: string | null;
  /** 0 for the first run of a repeat series; runs 2..N are deterministic replays. */
  repeatIndex: number;
  lane: EvaluationLane;
  /** Whether recording, proposal, and approval produced a runnable Flow; `null` on the recording lane. */
  flowCreated: boolean | null;
  /** The fixture oracle's verdict (final state against `expected`); `null` when it was not consulted. */
  oracleVerdict: "passed" | "failed" | null;
  /**
   * What FluxIQ reported for the run; `null` when nothing ran.
   *
   * `unverified` is neither: the run's steps all succeeded and its result was
   * never judged, because the run reached no model to judge it with. It is a
   * third outcome rather than a `passed` because a result nobody checked is
   * not a result that was right -- seven live runs on 2026-09-18 returned the
   * wrong records and reported `passed` on their steps alone -- and rather
   * than a `failed` because a deterministic replay of a saved Flow with no
   * model is how most automations run, and failing them all for the absence of
   * a judgement would break working automations to make a point.
   *
   * It counts as neither a false success nor a false failure: the bench's
   * accuracy rates take it in their denominator and never as a hit, which is
   * exactly what "nobody knows" should do to a measured rate.
   */
  reportedVerdict: "passed" | "failed" | "unverified" | null;
  /** Present exactly when `reportedVerdict` is `failed`; `ambiguous_or_unknown` when FluxIQ gave no category. */
  automationFailureReported: { category: AutomationStudioAdaptiveFailureClass; code?: string } | null;
  automationFailureExpected: ExpectedFailure | null;
  /** LLM interventions the run requested. Week 1 requires 0 with the provider disabled; that is measured, not enforced. */
  harnessActivations: number;
  /** Wall-clock run duration. */
  durationMs: number;
  /** Every executed action, in execution order. */
  actions: RunActionLatency[];
  evidence: RunEvidenceSizes;
  llm: LlmUsage;
  /**
   * One measurement per extraction step, in step order; `[]` when the run
   * measured extraction and had no extraction step. `null` when extraction was
   * not measured, as in every evaluation written before schema 0.3 (D7).
   */
  extraction: RunExtractionMeasurement[] | null;
  /**
   * What Core's recovery harness did during the Flow run, read from Core's run
   * detail: `null` when it was not measured, which is every run on which no
   * Flow ran (the recording lane, and a Flow-lane run that built no Flow) and
   * every evaluation written before the field was defined. A run that needed
   * no recovery states `attempted: false`, never `null`.
   *
   * The field was reserved in schema 0.3, so defining it changes no version:
   * a 0.3 evaluation holding `null` reads exactly as before.
   */
  harnessRecovery: RunHarnessRecovery | null;
  /**
   * The Week 2 adaptation measurements (`adaptation-reuse.ts`), read from
   * Core's run detail and adaptation store. Each is `null` when the run did
   * not measure it, which is every run on which no Flow ran and every
   * evaluation written before the member was defined; only a run whose Flow
   * was created may state one. They were reserved in schema 0.3, so defining
   * them changes no version: a 0.3 evaluation holding `null` reads exactly as
   * before.
   *
   * `adaptationReuse.providerCalls` and `adaptationCost.providerCalls` are one
   * count and must agree, and both are 0 or `null` unless `llm.mode` is
   * `live`.
   */
  adaptationCost: RunAdaptationCost | null;
  adaptationValidation: RunAdaptationValidation | null;
  adaptationPersistence: RunAdaptationPersistence | null;
  adaptationReuse: RunAdaptationReuse | null;
};

export type CandidateComparison = {
  schemaVersion: typeof CANDIDATE_COMPARISON_SCHEMA_VERSION;
  baselineRunId: string;
  candidateRunId: string;
  safetyPassed: boolean;
  expectationSetEqual: boolean;
  evidenceComplete: boolean;
  metricDeltas: Record<string, number>;
  verdict: "improved" | "regressed" | "equivalent" | "rejected";
  reasons: string[];
};
