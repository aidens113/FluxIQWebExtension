import type { AutomationStudioAdaptiveFailureClass } from "./failure-category.js";
import type { LlmExecutionProfile } from "./llm.js";
import type { ExpectedFailure } from "./scenario.js";

export const EVALUATION_SCHEMA_VERSION = "0.1" as const;

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
 * false success is the inverse.
 */
export type RunEvaluation = {
  schemaVersion: typeof EVALUATION_SCHEMA_VERSION;
  runId: string;
  verdict: "passed" | "failed" | "inconclusive";
  /** Test-rig failure only; see the type comment. */
  failureCategory?: FailureCategory;
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
  /** What FluxIQ reported for the run; `null` when nothing ran. */
  reportedVerdict: "passed" | "failed" | null;
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
  /** Week 2 measurements: `null` in Week 1, reserved so the schema is already present. */
  harnessRecovery: null;
  adaptationCost: null;
  adaptationValidation: null;
  adaptationPersistence: null;
  adaptationReuse: null;
};

export type CandidateComparison = {
  schemaVersion: typeof EVALUATION_SCHEMA_VERSION;
  baselineRunId: string;
  candidateRunId: string;
  safetyPassed: boolean;
  expectationSetEqual: boolean;
  evidenceComplete: boolean;
  metricDeltas: Record<string, number>;
  verdict: "improved" | "regressed" | "equivalent" | "rejected";
  reasons: string[];
};
