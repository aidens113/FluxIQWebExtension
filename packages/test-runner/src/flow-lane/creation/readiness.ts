// Whether a created-Flow run may build at all, decided by the authoring mode
// the run's Core was started in (`../../live-llm/authoring-mode-env.ts`, Core's
// `FLUXIQ_AUTHORING_MODE`) and, in candidate and project mode, by what that Core
// says about candidate trials.
//
// In `legacy` mode Core proposes an adaptation that the lane applies, runs and
// judges, as at the baseline (downstream `92d790d7`, Core `e9b7d691`).
//
// In `candidate` mode (t348, design unit U4) Core test-runs each submitted
// candidate once from its declared start and proposes it only after a judged,
// confirmed yes (t340). The Lab admits that only when both hold:
//
// - the Core under test has the trial runner: its generation readiness carries
//   `capabilities.candidateTrial` (`lab.candidate_verification_unavailable`
//   otherwise); and
// - the Core was started with the start hook (decision D1) pointed at the
//   Lab's own fixture reset, so every trial starts from the seeded fixture
//   rather than from exploration's or an earlier trial's leftovers
//   (`capabilities.candidateTrial.startReset`; `lab.candidate_start_hook_unset`
//   otherwise).
//
// **The fixture reset between trials is on unless a run asks to prove the
// model's own reset (t470, t472).** Since t462 the model returns the site to the
// build's start before every trial, through the site's own controls, and its
// reset gate runs and logs its evidence either way. t470 turned the Lab's reset
// off for every live build so a run would show that reset working; lane D round
// 9 (run-mv5q4j2n-25784472) showed it is not yet sound (the model judged a dirty
// site clean), so every trial measured leftovers. Qualification runs therefore
// keep the fixture reset again, and only a run started with
// `--model-reset-only` (`labCandidateTrialFixtureReset`) gets no start hook. That
// run is admitted only when its Core has none: `fixtureResetBetweenTrials`
// false, `startReset` false. A Core that would still reset between trials is
// refused (`lab.candidate_start_hook_set`), so the receipt never says what the
// run did not do. The fixture is
// still seeded when the run starts, and the lane resets it before playback.
//
// In `project` mode (automation-project-agents-plan, W4) a project supervisor
// plans the Flow's subflows, a builder authors each, and the assembled whole is
// submitted as one candidate through the same trial runner and promotion owner
// (Core `model/authoring-mode/`). The Lab therefore admits it on exactly the
// candidate terms -- the trial runner, and the start hook unless the run proves
// the model's own reset -- with the same refusal codes, worded for a project
// build. `createdFlowTrialsCandidates` is the one test of "a mode whose builds
// are tested candidates"; callers ask it rather than spelling `candidate`.
//
// Both are refused before any provider call. Before Core starts, the Lab asks
// what it will start (`labCandidateTrialReadiness`); once Core runs, the lane
// asks Core itself (`readCreatedFlowCandidateTrialReadiness`). A caller's
// verdict, a model's answer or any mode other than Core's exact spelling never
// admits.

import { AUTOMATION_STUDIO_ENDPOINTS, AUTOMATION_STUDIO_FLOW_BOOTSTRAP_GENERATION_READINESS, parseAutomationStudioFlowBootstrapGenerationReadiness, type AutomationStudioAuthoringMode } from "fluxiq/automation-studio";
import { RunnerFailure } from "../../failure.js";
import type { FluxIQHttpOptions } from "../../http-control/index.js";
import { retriedRead } from "./retried-read.js";

/**
 * What the Core under test can do with a candidate. `trialRunner`: Core tests a
 * candidate before proposing it. `startReset`: each trial starts from the
 * Lab's fixture reset. `fixtureResetBetweenTrials`: whether this run means the
 * fixture to be reset between trials (`labCandidateTrialFixtureReset`), which
 * `startReset` must match. `source`: `core` when Core's own readiness said so,
 * `lab-plan` when it is what the Lab will start, asked before Core runs.
 */
export type CreatedFlowCandidateTrialReadiness = Readonly<{ trialRunner: boolean; startReset: boolean; fixtureResetBetweenTrials: boolean; source: "core" | "lab-plan" }>;

/**
 * Whether the Lab resets the fixture between a candidate build's trials:
 * always, live or not, so each trial starts from the seeded fixture, unless the
 * run was started with `--model-reset-only` to prove the model's own reset
 * (t462) -- then never, so the trials start from what that reset left (t472).
 */
export function labCandidateTrialFixtureReset(run: { modelResetOnly: boolean }): boolean {
  return !run.modelResetOnly;
}

/**
 * Refuses `--model-reset-only` for a run whose Core builds no tested candidate:
 * the flag only says how a candidate's trials start, so it applies to a
 * `candidate` and a `project` build alike, and to nothing else.
 */
export function assertLabModelResetOnlyApplies(run: { modelResetOnly: boolean; authoringMode: AutomationStudioAuthoringMode | undefined }): void {
  if (run.modelResetOnly && !createdFlowTrialsCandidates(run.authoringMode)) throw new Error("--model-reset-only applies to the trials of a candidate or project build: pass --authoring-mode candidate or --authoring-mode project");
}

/** The authoring modes whose builds Core test-runs as a candidate before proposing: `candidate`, and `project`, whose assembled candidate takes the same trial and promotion. */
export const CREATED_FLOW_TRIAL_AUTHORING_MODES = Object.freeze(["candidate", "project"] as const);

/** A mode in `CREATED_FLOW_TRIAL_AUTHORING_MODES`. */
export type CreatedFlowTrialAuthoringMode = (typeof CREATED_FLOW_TRIAL_AUTHORING_MODES)[number];

/** Whether builds in `authoringMode` are tested candidates (`candidate`, `project`): only Core's exact spellings say so. */
export function createdFlowTrialsCandidates(authoringMode: unknown): authoringMode is CreatedFlowTrialAuthoringMode {
  return authoringMode === "candidate" || authoringMode === "project";
}

/** Whether a run whose Core authors in `authoringMode`, with `candidateTrial` in a trial mode (`candidate`, `project`), may build a Flow to qualify. */
export function createdFlowVerificationReady(authoringMode: AutomationStudioAuthoringMode, candidateTrial?: CreatedFlowCandidateTrialReadiness): boolean {
  if (authoringMode === "legacy") return true;
  return createdFlowTrialsCandidates(authoringMode) && candidateTrial?.trialRunner === true && typeof candidateTrial.fixtureResetBetweenTrials === "boolean" && candidateTrial.startReset === candidateTrial.fixtureResetBetweenTrials;
}

/** Refuses, before any provider call, a run whose Core cannot produce a Flow the lane may run. */
export function assertCreatedFlowVerificationReady(authoringMode: AutomationStudioAuthoringMode, candidateTrial?: CreatedFlowCandidateTrialReadiness): void {
  if (createdFlowVerificationReady(authoringMode, candidateTrial)) return;
  const mode = typeof authoringMode === "string" ? authoringMode : "unrecognized";
  const common = { stage: "before_provider", authoringMode: mode, providerInvocation: "not_attempted_by_this_entry", priorProviderCost: "unknown", ...(candidateTrial ? { candidateTrial: { trialRunner: candidateTrial.trialRunner, startReset: candidateTrial.startReset, fixtureResetBetweenTrials: candidateTrial.fixtureResetBetweenTrials, source: candidateTrial.source } } : {}) };
  if (!createdFlowTrialsCandidates(authoringMode)) {
    throw new RunnerFailure("facility.contract", "Created-Flow qualification is unavailable: the run's Core authoring mode is not one the Lab recognizes.", { details: { code: "lab.candidate_verification_unavailable", ...common } });
  }
  const words = REFUSAL_WORDS[authoringMode];
  if (candidateTrial?.trialRunner === true && !candidateTrial.fixtureResetBetweenTrials) {
    throw new RunnerFailure("facility.contract", words.hookSet, { details: { code: "lab.candidate_start_hook_set", ...common } });
  }
  if (candidateTrial?.trialRunner === true) {
    throw new RunnerFailure("facility.contract", words.hookUnset, { details: { code: "lab.candidate_start_hook_unset", ...common } });
  }
  throw new RunnerFailure("facility.contract", words.noTrialRunner, { details: { code: "lab.candidate_verification_unavailable", ...common } });
}

/** Each trial mode's refusals, in its own words; the codes are shared, so a reader of one reads the other. */
const REFUSAL_WORDS: Readonly<Record<CreatedFlowTrialAuthoringMode, Readonly<{ hookSet: string; hookUnset: string; noTrialRunner: string }>>> = Object.freeze({
  candidate: Object.freeze({
    hookSet: "A --model-reset-only candidate build runs each trial from what the model's own reset left, but the Core under test resets the fixture before each trial; it must be started without the candidate start hook.",
    hookUnset: "Created-Flow qualification in candidate authoring mode needs the Core under test started with the candidate start hook pointed at the Lab's fixture reset, so every trial starts from the seeded fixture; it was not.",
    noTrialRunner: "Created-Flow qualification in candidate authoring mode needs a Core that test-runs and judges each candidate before proposing it; the Core under test does not say it does.",
  }),
  project: Object.freeze({
    hookSet: "A --model-reset-only project build runs each trial of its assembled Flow and of its subflows from what the model's own reset left, but the Core under test resets the fixture before each trial; it must be started without the candidate start hook.",
    hookUnset: "Created-Flow qualification in project authoring mode needs the Core under test started with the candidate start hook pointed at the Lab's fixture reset, so the assembled Flow's trials start from the seeded fixture; it was not.",
    noTrialRunner: "Created-Flow qualification in project authoring mode needs a Core that test-runs and judges the assembled candidate before proposing it; the Core under test does not say it does.",
  }),
});

/**
 * What the Lab will start, asked before anything starts: whether the linked
 * Core's readiness contract carries the trial runner, and whether the Lab
 * starts that Core itself with the start hook -- only a Core the Lab starts
 * gets it (`../../environment.ts`), so an existing deployment never does, and
 * only when the run resets the fixture between trials.
 */
export function labCandidateTrialReadiness(target: { startsCore: boolean; fixtureResetBetweenTrials: boolean }): CreatedFlowCandidateTrialReadiness {
  const contract: { capabilities: Partial<typeof AUTOMATION_STUDIO_FLOW_BOOTSTRAP_GENERATION_READINESS.capabilities> } = AUTOMATION_STUDIO_FLOW_BOOTSTRAP_GENERATION_READINESS;
  return Object.freeze({ trialRunner: contract.capabilities.candidateTrial !== undefined, startReset: target.startsCore && target.fixtureResetBetweenTrials, fixtureResetBetweenTrials: target.fixtureResetBetweenTrials, source: "lab-plan" });
}

/**
 * What the running Core says, through its generation readiness, parsed by
 * Core's own reader: a record that reader refuses -- a Core without the trial
 * runner, or one older than the start-hook field -- has no trial runner.
 */
export async function readCreatedFlowCandidateTrialReadiness(
  control: {
    automationStudioCall(endpoint: string, payload: Record<string, unknown>, bounds?: FluxIQHttpOptions, domainId?: string): Promise<unknown>;
    /** How the read tells time and waits between tries; the real clock when absent. Tests pass a fake. */
    readClock?: Readonly<{ now(): number; sleep(ms: number): Promise<void> }>;
  },
  domainId: string,
  bounds: FluxIQHttpOptions = {},
  /** Whether the run means the fixture to be reset between trials (`labCandidateTrialFixtureReset`); the reset, as before, when absent. */
  fixtureResetBetweenTrials = true,
): Promise<CreatedFlowCandidateTrialReadiness> {
  // A safe read, so it is retried like every other one (`./retried-read.ts`).
  const endpoint = AUTOMATION_STUDIO_ENDPOINTS.getFlowBootstrapGenerationReadiness;
  const answer = await retriedRead(endpoint, () => control.automationStudioCall(endpoint, {}, bounds, domainId), control.readClock);
  const readiness = parseAutomationStudioFlowBootstrapGenerationReadiness(answer !== null && typeof answer === "object" ? (answer as { readiness?: unknown }).readiness : undefined);
  return Object.freeze({ trialRunner: readiness !== null, startReset: readiness?.capabilities.candidateTrial.startReset === true, fixtureResetBetweenTrials, source: "core" });
}
