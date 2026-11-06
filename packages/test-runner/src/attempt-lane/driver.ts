import type { AttemptAgainstEarlier, AttemptPath, AttemptSimulationResult, AttemptStandIn, ResolvedScenarioWorkflow, RunAnswerScore, WebScenario } from "@fluxiq-web-extension/test-contracts";
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

/**
 * What a later attempt began from. On a live run this is Core's own read of the attempt
 * (`AutomationStudioTaskAttempt.startedFrom`): the digest of the saved steps it found, and
 * `route`, what it did with them. A row with no such read has none, and is refused.
 */
export type AttemptStart = Readonly<{
  draftDigest: string | null;
  state?: AttemptSavedState["state"];
  flowId?: string;
  route?: "use" | "repair";
}>;

/** One attempt as a driver ended it. `startedFrom` is what it found saved before it began, and `null` is a blank workspace. */
export type AttemptOutcome = Readonly<{
  record: AttemptRecord;
  saved: AttemptSavedState | null;
  startedFrom: AttemptStart | null;
  answer: RunAnswerScore;
  oracleVerdict: "passed" | "failed" | null;
  standIns: readonly AttemptStandIn[];
  /** Said only of an attempt that began on what an earlier one left, with no reseed. */
  against?: AttemptAgainstEarlier;
  /** Said only of an attempt a person started with Run again: what became of each asked act. */
  askedAgain?: AttemptAskedAgain;
}>;

/** What a Run again did with each asked act, by name (`judgeAskedAgain`): moved again the asked way, left as it already stood, moved back, or never done. */
export type AttemptAskedAgain = Readonly<{ pressedAgain: readonly string[]; foundAsAsked: readonly string[]; undone: readonly string[]; notPressed: readonly string[] }>;

export type AttemptTask = Readonly<{ scenario: WebScenario; request: CreatedFlowRequest; workflow: ResolvedScenarioWorkflow }>;

/**
 * Runs one attempt at a task on one workspace. The series owns the order and the
 * workspace; a driver owns how an attempt happens: the scripted stand-in (`./scripted/`),
 * or the real chat and Core's own record of the attempt (`./live/live-driver.ts`).
 */
export type AttemptDriver = {
  /** Reseeds the site, so the attempt's baseline is the seed. A series that leaves the site as the last attempt left it calls this only before the first. */
  seedSite(): Promise<void>;
  run(task: AttemptTask, ordinal: number): Promise<AttemptOutcome>;
};
