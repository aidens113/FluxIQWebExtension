// Whether a created-Flow run may build at all, decided by the authoring mode
// the run's Core was started in (`../../live-llm/authoring-mode-env.ts`, Core's
// `FLUXIQ_AUTHORING_MODE`) and, in candidate mode, by what that Core says about
// candidate trials.
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
 * Lab's fixture reset. `source`: `core` when Core's own readiness said so,
 * `lab-plan` when it is what the Lab will start, asked before Core runs.
 */
export type CreatedFlowCandidateTrialReadiness = Readonly<{ trialRunner: boolean; startReset: boolean; source: "core" | "lab-plan" }>;

/** Whether a run whose Core authors in `authoringMode`, with `candidateTrial` in candidate mode, may build a Flow to qualify. */
export function createdFlowVerificationReady(authoringMode: AutomationStudioAuthoringMode, candidateTrial?: CreatedFlowCandidateTrialReadiness): boolean {
  if (authoringMode === "legacy") return true;
  return authoringMode === "candidate" && candidateTrial?.trialRunner === true && candidateTrial.startReset === true;
}

/** Refuses, before any provider call, a run whose Core cannot produce a Flow the lane may run. */
export function assertCreatedFlowVerificationReady(authoringMode: AutomationStudioAuthoringMode, candidateTrial?: CreatedFlowCandidateTrialReadiness): void {
  if (createdFlowVerificationReady(authoringMode, candidateTrial)) return;
  const mode = typeof authoringMode === "string" ? authoringMode : "unrecognized";
  const common = { stage: "before_provider", authoringMode: mode, providerInvocation: "not_attempted_by_this_entry", priorProviderCost: "unknown", ...(candidateTrial ? { candidateTrial: { trialRunner: candidateTrial.trialRunner, startReset: candidateTrial.startReset, source: candidateTrial.source } } : {}) };
  if (authoringMode === "candidate" && candidateTrial?.trialRunner === true) {
    throw new RunnerFailure("facility.contract", "Created-Flow qualification in candidate authoring mode needs the Core under test started with the candidate start hook pointed at the Lab's fixture reset, so every trial starts from the seeded fixture; it was not.", { details: { code: "lab.candidate_start_hook_unset", ...common } });
  }
  throw new RunnerFailure("facility.contract", authoringMode === "candidate"
    ? "Created-Flow qualification in candidate authoring mode needs a Core that test-runs and judges each candidate before proposing it; the Core under test does not say it does."
    : "Created-Flow qualification is unavailable: the run's Core authoring mode is not one the Lab recognizes.", { details: { code: "lab.candidate_verification_unavailable", ...common } });
}

/**
 * What the Lab will start, asked before anything starts: whether the linked
 * Core's readiness contract carries the trial runner, and whether the Lab
 * starts that Core itself -- only a Core the Lab starts gets the start hook
 * (`../../environment.ts`), so an existing deployment never does.
 */
export function labCandidateTrialReadiness(target: { startsCore: boolean }): CreatedFlowCandidateTrialReadiness {
  const contract: { capabilities: Partial<typeof AUTOMATION_STUDIO_FLOW_BOOTSTRAP_GENERATION_READINESS.capabilities> } = AUTOMATION_STUDIO_FLOW_BOOTSTRAP_GENERATION_READINESS;
  return Object.freeze({ trialRunner: contract.capabilities.candidateTrial !== undefined, startReset: target.startsCore, source: "lab-plan" });
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
): Promise<CreatedFlowCandidateTrialReadiness> {
  // A safe read, so it is retried like every other one (`./retried-read.ts`).
  const endpoint = AUTOMATION_STUDIO_ENDPOINTS.getFlowBootstrapGenerationReadiness;
  const answer = await retriedRead(endpoint, () => control.automationStudioCall(endpoint, {}, bounds, domainId), control.readClock);
  const readiness = parseAutomationStudioFlowBootstrapGenerationReadiness(answer !== null && typeof answer === "object" ? (answer as { readiness?: unknown }).readiness : undefined);
  return Object.freeze({ trialRunner: readiness !== null, startReset: readiness?.capabilities.candidateTrial.startReset === true, source: "core" });
}
