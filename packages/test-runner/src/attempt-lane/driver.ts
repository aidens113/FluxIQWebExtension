import type { AttemptPath, AttemptSimulationResult, AttemptStandIn, ResolvedScenarioWorkflow, RunAnswerScore, WebScenario } from "@fluxiq-web-extension/test-contracts";
import type { CreatedFlowRequest } from "../flow-lane/index.js";

/** What Core's attempt record says of one attempt (`AutomationStudioTaskAttempt`), restated to what the Lab reads. */
export type AttemptRecord = Readonly<{
  taskId: string;
  attemptId: string;
  ordinal: number;
  projectId: string;
  /** The Flow it ran or wrote. Required on a path that runs one. */
  flowId?: string;
  path: AttemptPath;
  status: "achieved" | "budget_out" | "stopped_by_person" | "working" | "waiting_for_person";
  spend: Readonly<{ calls: number; inputTokens: number; outputTokens: number; usd: number; ms: number }>;
  liveSteps: number;
  simulation?: Readonly<{ verdict: AttemptSimulationResult; flags: number }>;
  /** Core's five patterns, each with its ladder counts. */
  loopsCaught: Readonly<Record<string, Readonly<{ steered: number; refused: number; changeApproach: number; askPerson: number }>>>;
  /** Lasting acts Core could not tie to a row; absent reads as zero. */
  actsWithNoRow?: number;
}>;

/** What an attempt left saved for the next (`AutomationStudioSavedState`), restated to what the proof reads. */
export type AttemptSavedState = Readonly<{
  state: "ready" | "partly_works" | "notes_only" | "needs_you";
  flowId?: string;
  /** A digest of what was saved, so "the second started from it" names one saved thing and not one of that name. */
  draftDigest: string | null;
}>;

/** One attempt as a driver ended it. `startedFrom` is what the driver found saved before it began, and `null` is a blank workspace. */
export type AttemptOutcome = Readonly<{
  record: AttemptRecord;
  saved: AttemptSavedState | null;
  startedFrom: AttemptSavedState | null;
  answer: RunAnswerScore;
  oracleVerdict: "passed" | "failed" | null;
  standIns: readonly AttemptStandIn[];
}>;

export type AttemptTask = Readonly<{ scenario: WebScenario; request: CreatedFlowRequest; workflow: ResolvedScenarioWorkflow }>;

/**
 * Runs one attempt at a task on one workspace. The series owns the order and the
 * workspace; a driver owns how an attempt happens. Today's is the scripted stand-in
 * (`./scripted/`). A live one starts from the extension chat on a persistent workspace
 * and reads Core's attempt record, once Core has a read for it.
 */
export type AttemptDriver = {
  /** Reseeds the site, so the attempt's baseline is the seed: final-state oracles are absolute, and the change is judged from it. */
  seedSite(): Promise<void>;
  run(task: AttemptTask, ordinal: number): Promise<AttemptOutcome>;
};
