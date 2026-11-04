// One saved Flow run offline end to end through the real intake: the candidate the store
// kept, which a named live trial ran, run by Core's candidate trial runner with the state
// engine as its only client. Two arms: against the
// build's exploration, and against the live test before it, a recording in the Flow's own
// wire form. This is what the walk over recorded commands could not show (the go/no-go's
// limit 6): given recorded answers, which commands does the Flow really send?
//
// Provider-free and offline: the judge is one that calls no model, no socket is opened, and
// the host opens only a fresh copy under `test-runs/`. What comes back is ids, codes, counts
// and field paths. The task's own oracle judges the rows the offline run stored.

import { webTraceStateDomain } from "@fluxiq-web-extension/domain/node";
import { runAutomationStudioOfflineStateTrial, type AutomationStudioFlowCandidate, type AutomationStudioOfflineStateTrialOutcome } from "fluxiq/automation";
import path from "node:path";
import { openExperimentSession, type ExperimentSession } from "../../experiment-session.js";
import { judgeTrialDatasets, readTrialDatasets } from "../../oracle/index.js";
import { scriptExtractNodes } from "../../rebuild/index.js";
import { DECLARED_EXTENSION_SESSION_VIEW, freshStoreCopy, notJudgedJudge, offlineTrialPorts, openOfflineTrialHost } from "../../run/index.js";
import type { TracedRevision } from "../../types.js";
import { traceStateReceipts } from "../receipts.js";

/**
 * What a Flow is run against. `exploration`, the product's case; `previous_flow`, the live
 * test before it, a recording in the Flow's own form; `own_run`, the very live run it made,
 * which is the engine's parity check: any gap there is the engine's or Core's, and the rows
 * must be the same.
 */
export type EngineArm = "exploration" | "previous_flow" | "own_run";

export type EngineArmResult = Readonly<{
  arm: EngineArm;
  /** Why the arm did not run, as a code; null when it ran. */
  skipped: string | null;
  /** The pure verdict, or the refusal it never reached. */
  verdict: string | null;
  refusal: string | null;
  scope: string | null;
  origins: readonly string[];
  liveEpisodeId: string | null;
  execution: string | null;
  /** The trial's own code when it did not run, or ran and failed: a closed code. */
  trialCode: string | null;
  recorded: number;
  answered: number;
  computed: number;
  gaps: Readonly<Record<string, number>>;
  firstGap: Readonly<{ ordinal: number; code: string; actionType: string; fields: readonly string[] }> | null;
  /** The step the run stopped at and why, when it stopped: a closed code. */
  stopped: Readonly<{ step: number; code: string | null }> | null;
  /** Every gap of the run, in order, with the step it sits on. */
  stepGaps: readonly Readonly<{ step: number | null; code: string; actionType: string; wentOn: boolean }>[];
  assertions: readonly string[];
  deliveredEvents: number;
  withheldDeliveries: number;
  bookkeepingCommands: number;
  feedbackSteps: number;
  /** What the task's own oracle says of the rows the offline run stored; null when it stored none it could judge. */
  oracle: string | null;
  storedRows: number;
  wallMs: number;
}>;

export type EngineBuildResult = Readonly<{
  runId: string;
  task: string;
  labVerdict: string;
  oracleVerdict: string | null;
  /** What the live judge said of the Flow run offline. */
  liveVerdict: string | null;
  /** What the live judge said of the previous live test, the second arm's reference. */
  referenceVerdict: string | null;
  /** Why no candidate could be run: a code; null when one was. */
  notRun: string | null;
  arms: readonly EngineArmResult[];
}>;

const EMPTY: Omit<EngineArmResult, "arm" | "skipped"> = { verdict: null, refusal: null, scope: null, origins: [], liveEpisodeId: null, execution: null, trialCode: null, recorded: 0, answered: 0, computed: 0, gaps: {}, firstGap: null, stopped: null, stepGaps: [], assertions: [], deliveredEvents: 0, withheldDeliveries: 0, bookkeepingCommands: 0, feedbackSteps: 0, oracle: null, storedRows: 0, wallMs: 0 };

/** The step a run's feedback says it stopped at, by its number and its failure's code. */
function stoppedAt(steps: unknown): EngineArmResult["stopped"] {
  if (!Array.isArray(steps)) return null;
  for (const entry of steps as readonly { readonly step?: unknown; readonly status?: unknown; readonly failureCode?: unknown }[]) {
    if (entry.status === "failed" && typeof entry.step === "number") return Object.freeze({ step: entry.step, code: typeof entry.failureCode === "string" ? entry.failureCode : null });
  }
  return null;
}

/** The workspace a project store belongs to: its `.fluxiq` directory and its project id. */
export function projectStoreWorkspace(storeFile: string): Readonly<{ fluxiqDir: string; projectId: string }> {
  const project = path.dirname(storeFile);
  return Object.freeze({ fluxiqDir: path.resolve(project, "..", "..", "..", ".."), projectId: path.basename(project) });
}

export async function replayBuildOnEngine(input: {
  run: Readonly<{ runId: string; task: string; scenario: string; verdict: string; oracleVerdict: string | null; directory: string }>;
  fluxiqDir: string;
  projectId: string;
  work: string;
  repositoryRoot: string;
}): Promise<EngineBuildResult> {
  const { run } = input;
  const base = { runId: run.runId, task: run.task, labVerdict: run.verdict, oracleVerdict: run.oracleVerdict };
  const stepsDir = path.join(run.directory, "steps");
  const opened = await openForRun(input, stepsDir);
  if ("notRun" in opened) return Object.freeze({ ...base, liveVerdict: null, referenceVerdict: null, notRun: opened.notRun, arms: [] });
  const { session, last, previous, candidate } = opened;
  const submission = [...session.steps.submissions].reverse().find((written) => written.digest === last.subflow?.digest && written.revision === last.subflow?.revision);
  const arms: EngineArmResult[] = [];
  for (const arm of ["exploration", "previous_flow", "own_run"] as const) {
    const traceId = arm === "exploration" ? session.build.explorationTraceId : arm === "own_run" ? last.traceId : previous?.traceId;
    if (traceId === undefined) {
      arms.push(Object.freeze({ arm, skipped: "no_previous_flow", ...EMPTY }));
      continue;
    }
    arms.push(await runArm({ arm, traceId, input, session, candidate, source: last, script: submission?.script ?? null, referenceVerdict: previous?.test?.verdict ?? null }));
  }
  return Object.freeze({ ...base, liveVerdict: last.test?.verdict ?? null, referenceVerdict: previous?.test?.verdict ?? null, notRun: null, arms: Object.freeze(arms) });
}

/**
 * The Flow as the store kept it, not a rebuild: a saved run's script compiled by today's Core
 * need not give the digest that ran, while the stored candidate is what ran. It is the one
 * the live trial it names ran. That trial, and the live test before it, are the two arms' subject and reference.
 */
async function openForRun(input: { fluxiqDir: string; projectId: string; work: string; repositoryRoot: string; run: { scenario: string; task: string } }, stepsDir: string): Promise<{ notRun: string } | { session: ExperimentSession; last: TracedRevision; previous: TracedRevision | undefined; candidate: AutomationStudioFlowCandidate }> {
  let session: ExperimentSession;
  const copy = await freshStoreCopy({ sourceFluxiqDir: input.fluxiqDir, work: path.join(input.work, "session") });
  try {
    session = await openExperimentSession({
      fluxiqDir: copy.fluxiqDir, projectId: input.projectId, stepsDir,
      oracle: { repositoryRoot: input.repositoryRoot, scenarioLabDist: path.join(input.repositoryRoot, "apps", "scenario-lab", "dist"), scenarioId: input.run.scenario, taskId: input.run.task },
    });
  } catch (error) {
    return { notRun: `session:${error instanceof Error ? error.message.slice(0, 80) : "unreadable"}` };
  }
  const candidate = session.context.draft.candidate as AutomationStudioFlowCandidate | undefined;
  const ran = session.traced.filter((revision) => revision.whole.digest === candidate?.digest);
  const last = ran.at(-1);
  if (last === undefined || candidate === undefined) return { notRun: "no_trial_of_the_stored_candidate" };
  const earlier = session.traced.slice(0, session.traced.indexOf(last)).filter((revision) => revision.test !== null);
  return { session, last, previous: earlier.at(-1), candidate };
}

async function runArm(input: {
  arm: EngineArm;
  traceId: string;
  input: { fluxiqDir: string; projectId: string; work: string };
  session: ExperimentSession;
  candidate: AutomationStudioFlowCandidate;
  source: TracedRevision;
  script: string | null;
  referenceVerdict: string | null;
}): Promise<EngineArmResult> {
  const { arm, traceId, session, candidate, source } = input;
  const copy = await freshStoreCopy({ sourceFluxiqDir: input.input.fluxiqDir, work: path.join(input.input.work, arm) });
  const host = openOfflineTrialHost({ rootDir: copy.rootDir });
  const judge = notJudgedJudge();
  const started = performance.now();
  let outcome: AutomationStudioOfflineStateTrialOutcome;
  try {
    const sourceInstructionIds = Array.isArray(session.context.draft.sourceInstructionIds) ? session.context.draft.sourceInstructionIds.filter((id): id is string => typeof id === "string") : [];
    const ports = await offlineTrialPorts({ service: host.service, projectId: input.input.projectId, flowId: session.build.flowId, sourceInstructionIds, startLocation: session.build.startLocation, judge: judge.judge });
    const { revision, digest } = source.whole;
    outcome = await runAutomationStudioOfflineStateTrial({
      request: { candidateId: source.candidateId, revision, digest, signal: new AbortController().signal, candidate: structuredClone({ ...candidate, revision }) },
      // The build's Flow moved on after this trial; the replay asks of the base the candidate was written on, which is the one the live trial ran on.
      ports: { ...ports, currentBaseDigest: async () => candidate.baseDependencyDigest },
      source: { store: host.traceStore(input.input.projectId), traceId },
      gateway: host.gateway,
      phase: "test",
      domain: webTraceStateDomain,
      // No saved exploration was ever judged, so that arm stands in as if it had been: a pass there is only ever measured here. The second arm's reference has a real judge.
      reference: arm !== "previous_flow" || input.referenceVerdict === "yes" ? "judged_yes" : "unjudged",
      upToFirstChild: arm === "exploration",
      receipts: (calls) => traceStateReceipts(calls, webTraceStateDomain),
      sessionView: structuredClone(DECLARED_EXTENSION_SESSION_VIEW),
    });
  } finally {
    await host.close();
  }
  const wallMs = Math.round(performance.now() - started);
  if (outcome.status === "refused") return Object.freeze({ arm, skipped: null, ...EMPTY, refusal: outcome.reasonCode, wallMs });
  const { engine, evidence, trial, stepGaps } = outcome;
  const gaps: Record<string, number> = {};
  for (const gap of engine.gaps) gaps[gap.reason] = (gaps[gap.reason] ?? 0) + 1;
  const first = engine.gaps[0];
  const runId = trial.record.trialRunId ?? null;
  const rows = runId === null ? [] : await readTrialDatasets({ automationDataDir: path.join(copy.fluxiqDir, "artifacts", "automation-studio"), projectId: input.input.projectId, runId });
  const oracle = runId === null ? null : judgeTrialDatasets({ scenarioOrigin: session.build.scenarioOrigin }, session.oracle, runId, rows, input.script === null ? undefined : scriptExtractNodes(input.script, session.context.surroundings));
  const steps = trial.result.feedback.steps;
  return Object.freeze({
    arm, skipped: null, verdict: evidence.verdict, refusal: null, scope: evidence.scope, origins: evidence.evidenceOrigins, liveEpisodeId: evidence.liveEpisodeId,
    execution: trial.record.execution,
    trialCode: trial.record.code ?? null,
    recorded: engine.recordedOperations, answered: engine.matchedOperations.length,
    computed: engine.matchedOperations.filter((operation) => operation.answeredFrom === "computed").length,
    gaps,
    firstGap: first === undefined ? null : Object.freeze({ ordinal: first.ordinal, code: first.reason, actionType: first.actionType, fields: first.fields.map((field) => field.replace(/\.\d+/gu, "[]")).slice(0, 12) }),
    stopped: stoppedAt(steps),
    stepGaps: stepGaps.map((gap) => Object.freeze({ step: gap.step, code: gap.reason, actionType: gap.actionType, wentOn: gap.wentOn })),
    assertions: evidence.assertionsChecked.filter((assertion) => assertion.outcome === "violated").map((assertion) => assertion.id),
    deliveredEvents: engine.deliveredSequences.length, withheldDeliveries: engine.withheldDeliveries, bookkeepingCommands: engine.bookkeepingCommands,
    feedbackSteps: Array.isArray(steps) ? steps.length : 0,
    oracle: oracle === null ? null : oracle.passed ? "passed" : "failed",
    storedRows: rows.reduce((sum, dataset) => sum + dataset.records.length, 0),
    wallMs,
  });
}
