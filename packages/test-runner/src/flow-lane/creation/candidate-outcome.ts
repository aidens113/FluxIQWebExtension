// What a candidate-mode build came to, as the Lab records it (t348, design
// unit U4): the candidate, the trials Core ran of it, the verdict that decided,
// and the proposal it became when it was promoted.
//
// Core test-runs each submitted candidate once from its declared start, under
// a runtime session of its own whose `metadata.candidateTrial` names the
// candidate (t340, `runtime/service/candidate-trial/run.ts`). A candidate whose
// standing verdict is a confirmed yes becomes an ordinary proposed adaptation,
// whose `created` audit event carries `candidateTrial`
// (`service/candidate-trial/promotion.ts`); anything else stays a draft that is
// never applied, with the verdict and Core's codes.
//
// Everything here is identifiers, counts and closed codes. A trial session's
// Flow document, trace and page evidence are read past, never kept.
//
// A draft is a product outcome, not a facility one: the build ran, the model's
// candidate was tested and was not good enough, so the lane fails it as
// `runtime.behavior` with the candidate id and the verdicts
// (`createdFlowCandidateDraftFailure`).

import { automationStudioConversationCandidateDraftSaid, type AutomationStudioCandidateAuthoringResult, type AutomationStudioCandidateTrialOutcomeVerdict } from "fluxiq/automation-studio";
import { RunnerFailure } from "../../failure.js";

/** One trial Core ran of the candidate, from its runtime session. */
export type CreatedFlowCandidateTrialRun = Readonly<{
  runId: string;
  revision: number | null;
  digest: string | null;
  /** How the trial's start was prepared: `reset` through the Lab's fixture reset, `not_reset`, or `failed`. */
  start: string | null;
  /** How the run of the candidate ended: `succeeded`, `failed`, `cancelled`, or `null` while Core had not written it. */
  execution: string | null;
  code: string | null;
}>;

/**
 * The candidate-mode record a build carries.
 *
 * - `verdict`: the standing verdict, the one that decided. `unknown` when Core
 *   said nothing the Lab could read it from.
 * - `trialRunId`, `codes`, `judgeCalls`, `trialCount`: what Core said about
 *   that verdict; `null` or empty where it said nothing.
 * - `trials`: every trial session of the candidate, in the order Core queued
 *   them; `null` when Core answered no list of sessions.
 * - `promotedAdaptationId`: the proposal the candidate became; `null` for a draft.
 */
export type CreatedFlowCandidateOutcome = Readonly<{
  authoringMode: "candidate";
  outcome: "promoted" | "draft";
  candidateId: string;
  revision: number | null;
  digest: string | null;
  verdict: AutomationStudioCandidateTrialOutcomeVerdict | "unknown";
  trialRunId: string | null;
  codes: readonly string[];
  judgeCalls: number | null;
  trialCount: number | null;
  trials: readonly CreatedFlowCandidateTrialRun[] | null;
  promotedAdaptationId: string | null;
}>;

type CandidateControl = { automationStudioCall(endpoint: string, payload: Record<string, unknown>): Promise<unknown> };

const VERDICTS: readonly AutomationStudioCandidateTrialOutcomeVerdict[] = ["yes", "no", "unsure", "not_judged", "execution_failed", "not_tested"];
const CODE = /^[A-Za-z][A-Za-z0-9_.:-]{0,95}$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/u;

/**
 * The candidate behind a promoted proposal, read from the `candidateTrial`
 * detail Core recorded on its `created` audit event. `null` for a proposal
 * that carries none -- a legacy build's.
 */
export async function readCreatedFlowCandidatePromotion(control: CandidateControl, subject: { projectId: string; flowId: string }, adaptationId: string): Promise<CreatedFlowCandidateOutcome | null> {
  const answer = await control.automationStudioCall("get-flow-adaptation", { ...subject, adaptationId });
  const adaptation = field(answer, "adaptation"), phase9 = field(field(adaptation, "metadata"), "phase9");
  const events = field(phase9, "auditEvents");
  const created = Array.isArray(events) ? events.find((event) => field(event, "eventType") === "created") : undefined;
  const detail = field(field(created, "detail"), "candidateTrial"), trial = field(detail, "trial");
  const candidateId = identifier(field(detail, "candidateId"));
  if (candidateId === null) return null;
  return Object.freeze({
    authoringMode: "candidate", outcome: "promoted", candidateId,
    revision: whole(field(detail, "revision")), digest: identifier(field(detail, "digest")),
    verdict: field(trial, "verdict") === "yes" ? "yes" : "unknown",
    trialRunId: identifier(field(trial, "runId")), codes: Object.freeze([]),
    judgeCalls: whole(field(trial, "calls")), trialCount: whole(field(detail, "trials")),
    trials: await readCandidateTrials(control, subject, candidateId),
    promotedAdaptationId: adaptationId,
  });
}

/** A draft the direct build endpoint answered with: its own trial block names the verdict, run and codes. */
export async function createdFlowCandidateDraftOutcome(control: CandidateControl, candidate: AutomationStudioCandidateAuthoringResult): Promise<CreatedFlowCandidateOutcome> {
  return Object.freeze({
    authoringMode: "candidate", outcome: "draft", candidateId: candidate.candidateId,
    revision: candidate.revision, digest: candidate.digest,
    verdict: candidate.trial?.verdict ?? "unknown",
    trialRunId: candidate.trial?.runId ?? null, codes: Object.freeze((candidate.trial?.codes ?? []).filter((code) => CODE.test(code))),
    judgeCalls: null, trialCount: null,
    trials: await readCandidateTrials(control, candidate, candidate.candidateId),
    promotedAdaptationId: null,
  });
}

/**
 * A draft the chat kept. The thread names the candidate (`candidate-draft`
 * turn) and says the verdict in Core's own words
 * (`automationStudioConversationCandidateDraftSaid`), which are matched here
 * against those same words for each verdict; the trials come from Core's
 * trial sessions, and the last of them is the one that decided.
 */
export async function createdFlowChatCandidateDraftOutcome(control: CandidateControl, subject: { projectId: string; flowId: string }, candidateId: string, said: string | null): Promise<CreatedFlowCandidateOutcome> {
  const read = chatDraftVerdict(said);
  const trials = await readCandidateTrials(control, subject, candidateId);
  const last = trials?.at(-1);
  return Object.freeze({
    authoringMode: "candidate", outcome: "draft", candidateId,
    revision: last?.revision ?? null, digest: last?.digest ?? null,
    verdict: read.verdict, trialRunId: last?.runId ?? null, codes: Object.freeze(read.codes),
    judgeCalls: null, trialCount: trials?.length ?? null, trials,
    promotedAdaptationId: null,
  });
}

/** The lane's failure for a candidate that stayed a draft: a product outcome, with the candidate and its verdicts. */
export function createdFlowCandidateDraftFailure(outcome: CreatedFlowCandidateOutcome, said: string | null): RunnerFailure {
  const codes = outcome.codes.length ? `; ${outcome.codes.join(", ")}` : "";
  return new RunnerFailure("runtime.behavior", `FluxIQ kept its candidate as a draft and built no Flow: the candidate's test run was judged ${outcome.verdict} (candidate ${outcome.candidateId}${codes})${said ? `; it said: ${JSON.stringify(said)}` : ""}`, {
    details: {
      code: "lab.candidate_not_promoted", stage: "verification", authoringMode: "candidate",
      candidateId: outcome.candidateId, revision: outcome.revision, verdict: outcome.verdict, codes: [...outcome.codes], trialRunId: outcome.trialRunId,
      trials: outcome.trials === null ? null : outcome.trials.map((trial) => ({ runId: trial.runId, revision: trial.revision, start: trial.start, execution: trial.execution, code: trial.code })),
    },
  });
}

/** Core's verdict words for a chat draft, matched exactly against what Core says for each verdict. */
function chatDraftVerdict(said: string | null): { verdict: CreatedFlowCandidateOutcome["verdict"]; codes: string[] } {
  if (!said) return { verdict: "unknown", codes: [] };
  const template: AutomationStudioCandidateAuthoringResult = { status: "draft", projectId: "", flowId: "", candidateId: "", revision: 0, digest: "", sourceInstructionIds: [], baseDependencyDigest: "", baseSettingsRevision: 0, verification: "not_performed", promotionAllowed: false, accounting: { requestId: "", estimatedInputTokens: 0 } };
  const words = said.trim();
  for (const verdict of VERDICTS) {
    for (const codes of verdict === "yes" ? [["FLOW_BOOTSTRAP_STALE"], []] : [[]]) {
      if (automationStudioConversationCandidateDraftSaid({ ...template, trial: { verdict, codes } }).trim() === words) return { verdict, codes };
    }
  }
  return { verdict: "unknown", codes: [] };
}

/** Every trial session of `candidateId` on this Flow, from Core's runtime sessions; `null` when Core answered no list. A read that fails, fails. */
async function readCandidateTrials(control: CandidateControl, subject: { projectId: string; flowId: string }, candidateId: string): Promise<readonly CreatedFlowCandidateTrialRun[] | null> {
  const answer = await control.automationStudioCall("list-runtime-sessions", { projectId: subject.projectId });
  const sessions = field(answer, "runtimeSessions");
  if (!Array.isArray(sessions)) return null;
  const trials = sessions.flatMap((session) => {
    const trial = field(field(session, "metadata"), "candidateTrial"), runId = identifier(field(session, "runId"));
    if (runId === null || field(session, "flowId") !== subject.flowId || field(trial, "candidateId") !== candidateId) return [];
    const queuedAt = field(session, "queuedAt");
    return [{ queuedAt: typeof queuedAt === "number" ? queuedAt : 0, trial: Object.freeze({ runId, revision: whole(field(trial, "revision")), digest: identifier(field(trial, "digest")), start: code(field(trial, "start")), execution: code(field(trial, "execution")), code: code(field(trial, "code")) }) }];
  });
  return Object.freeze(trials.sort((a, b) => a.queuedAt - b.queuedAt).map((entry) => entry.trial));
}

function field(value: unknown, key: string): unknown {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>)[key] : undefined;
}

function whole(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : null;
}

function identifier(value: unknown): string | null {
  return typeof value === "string" && ID.test(value) ? value : null;
}

function code(value: unknown): string | null {
  return typeof value === "string" && CODE.test(value) ? value : null;
}
