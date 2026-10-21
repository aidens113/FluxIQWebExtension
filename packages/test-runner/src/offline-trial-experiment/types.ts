// The shapes the offline-trial experiment tools read and report. Every member
// is an identifier, a digest, a count, a code or a field name: no page text,
// typed value or token is carried in any of them, so a report built from these
// can be written down and shared.

import type { JsonObject } from "fluxiq/core";
import type { AutomationStudioFlowCandidate } from "fluxiq/automation-studio";

/** One `core.submit_subflow` Core accepted, as the Lab's step files hold it (`steps/<NNNN>-tool-core.submit_subflow/`). */
export type LabSubflowSubmission = Readonly<{
  step: number;
  folder: string;
  /** The brief the builder answered, from the step's `meta.json`; null where the step names none. */
  briefId: string | null;
  subflowKey: string;
  revision: number;
  digest: string;
  /** The subflow's whole text as Core accepted it (`result.json` `script`). Page content: never printed. */
  script: string;
}>;

/** One `core.test_subflow`, accepted or refused, as the Lab's step files hold it. */
export type LabSubflowTest = Readonly<{
  step: number;
  folder: string;
  briefId: string | null;
  /** The subflow proposal tested; null for a test Core refused before naming one. */
  revision: number | null;
  digest: string | null;
  /** The live trial's verdict (`yes`, `no`, `unsure`, `execution_failed`); null for a refused test. */
  verdict: string | null;
  /** The feedback's or the refusal's code. */
  code: string | null;
  trialRunId: string | null;
  /** The whole candidate the single-subflow test ran (`feedback.wholeTest`). */
  whole: Readonly<{ revision: number; digest: string }> | null;
  /** `feedback.stored.rows`: the rows the trial stored, as the builder was told. */
  storedRows: number | null;
}>;

export type LabSubflowSteps = Readonly<{
  submissions: readonly LabSubflowSubmission[];
  tests: readonly LabSubflowTest[];
}>;

/** A `test` trace mapped to the candidate its trial ran, from the trace manifest and the Lab step files. */
export type TracedRevision = Readonly<{
  traceId: string;
  /** The trace's episode, which for a trial is its run id. */
  trialRunId: string;
  candidateId: string;
  /** The whole candidate, from the manifest's `candidate_trial` context. */
  whole: Readonly<{ revision: number; digest: string }>;
  /** The test step whose trial this trace recorded; null when no step names the trial. */
  test: Readonly<{ step: number; verdict: string | null; code: string | null; storedRows: number | null }> | null;
  /** The subflow proposal the whole candidate was assembled from, and the accepted submission that holds its script. */
  subflow: Readonly<{ briefId: string | null; revision: number; digest: string; submitStep: number }> | null;
  events: number;
  artifacts: number;
}>;

/** One step resolution the build gave, taken from a persisted candidate: what the model wrote and what the domain made of it. */
export type RecordedResolution = Readonly<{
  nodeDefinitionId: string;
  /** The parameters Core asked the domain to resolve, as written (Core's defaults included). */
  written: JsonObject;
  /** The parameters the persisted candidate holds for that step. */
  resolved: JsonObject;
}>;

/** A step Core asked about that no recorded resolution answers, and how it differs from the nearest recorded step of its node. */
export type UnresolvedStep = Readonly<{
  nodeDefinitionId: string;
  /** Parameter paths that differ from the nearest recorded step of the same node; empty when the node has none recorded. */
  differingPaths: readonly string[];
  /** Why the seam could not answer from the record. */
  reason: string;
}>;

/** A rebuilt candidate, and whether Core's digests of it equal the recorded ones. */
export type CandidateRebuild = Readonly<{
  briefId: string;
  submitStep: number | null;
  subflow: Readonly<{ recorded: Readonly<{ revision: number; digest: string }> | null; rebuiltDigest: string | null; matches: boolean | null }>;
  whole: Readonly<{ recorded: Readonly<{ revision: number; digest: string }> | null; rebuiltDigest: string | null; matches: boolean | null }>;
  /** The whole candidate Core's controller made; null when any stage refused. Its `revision` is the fresh controller's, not the recorded one. */
  candidate: AutomationStudioFlowCandidate | null;
  /**
   * The stage Core's rebuild refused at and its codes: `plan` (the record's latest plan is not one single subflow,
   * `project.whole_trial_not_this_plan`), `subflow` (the scoped submission), `assembly` or `composed` (the whole candidate).
   */
  refusal: Readonly<{ stage: "plan" | "subflow" | "assembly" | "composed"; codes: readonly string[]; unresolved: readonly UnresolvedStep[] }> | null;
}>;

/** The task's own oracle over a run's stored rows: counts and codes only. */
export type OracleVerdict = Readonly<{
  runId: string;
  passed: boolean;
  datasets: number;
  storedRecords: number;
  expectedRecords: number;
  matchedRecords: number;
  matchedInAnyOrder: number;
  expectedFields: number;
  presentFields: number;
  /** The first failed assertion's category and message, which names steps, counts and field names, never a value. */
  failure: Readonly<{ category: string; message: string }> | null;
}>;

/** Whether a Core-side post-processing change alone could make rows already read satisfy the oracle, in counts. */
export type Tier1Derivability = Readonly<{
  derivable: boolean;
  storedRows: number;
  expectedRecords: number;
  /** Columns the expectation names that no stored row carries. */
  missingColumns: readonly string[];
  /** Expected records some stored row equals on every column both sides carry. */
  coveredOnSharedColumns: number;
  /** For each stored column, the expected column whose values it holds for the most expected records, when not its own. */
  columnsHoldingOther: readonly Readonly<{ stored: string; holds: string; expectedRecords: number }>[];
  reasons: readonly string[];
}>;
