// Journey E, first half: see a failure, without a provider.
//
// A Flow recorded by demonstration (`recorded-task.ts`) is run from the panel
// under No LLM intervention after the fixture's own drift control has broken
// the page for it. The run must fail, and a person watching Runtime Debug must
// see it fail: the Action Log shows the run as Failed, marks the failed
// attempt, and shows the run's terminal reason. Core's run detail is read
// beside the DOM, so what is shown is checked against what happened, and the
// scenario must not have reached its oracle.
//
// The recording and the drifted run use two browser sessions on one Core: a
// session's Scenario Lab starts fresh, so the drifted run begins from a page
// the recording never completed, and "the oracle was not reached" means what
// it says.
import { parseAutomationStudioFailureRecord } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";
import { type DemoWorkspaceConfiguration, type DemoWorkspaceState, openFlowInCurrentProject, openProjectInPanel, runDemoFlowFromPanel } from "../../demo-workspace/index.js";
import type { ExistingFluxIQControlClient, ExistingRunDetail } from "../../existing-fluxiq-control.js";
import { assertExpectedFacts, playwrightScenarioFactProbe } from "../../scenario-assertions.js";
import { loadScenarioManifest } from "../../scenarios.js";
import { connectExtensionForProject } from "./extension-project.js";
import { type FailedRunPresentation, readFailedRunPresentation } from "./failure-log.js";
import { assertProviderFreeRun } from "./provider-free-run.js";
import { RECORDED_TASKS, type RecordedTask, type RecordedTaskId, recordTaskFlow } from "./recorded-task.js";
import type { SavedJourneyFlow } from "./saved-flow.js";
import { type JourneySession, withJourneyBrowser, withJourneyCore } from "./session.js";
import { type JourneyCheckpoint, journeyTimeline } from "./timeline.js";

export type FailurePresentationJourneyOptions = Readonly<{
  /** Which recorded task and drift. `missing-target` by default: the drift a recorded Flow cannot survive. */
  task?: RecordedTaskId;
  flowId?: string;
  flowName?: string;
}>;

export type FailurePresentationJourneyResult = Readonly<{
  journey: "failure_presentation";
  status: "verified";
  task: RecordedTaskId;
  ids: Readonly<{ projectId: string; flowId: string; recordingId: string; runId: string }>;
  run: Readonly<{
    actionAttempts: number;
    failedAttempts: number;
    /** Core's closed failure taxonomy for the first failed attempt, or `null` when Core recorded no parseable failure. */
    failureCategory: string | null;
    failureCode: string | null;
    providerCalls: number;
  }>;
  presentation: FailedRunPresentation;
  oracleReached: false;
  /** The Flow as saved, on the baseline page it was recorded on, for the restart journey. */
  saved: SavedJourneyFlow;
  checkpoints: readonly JourneyCheckpoint[];
}>;

const DEFAULTS = { task: "missing-target", flowId: "flow.ui-e2e-failure", flowName: "UI E2E Failure" } as const;
const RUN_DETAIL_TIMEOUT_MS = 15_000;

/** Records the task's Flow in one browser session and presents its drifted failure in a second, on one Core. */
export async function runFailurePresentationJourney(config: DemoWorkspaceConfiguration, options: FailurePresentationJourneyOptions = {}): Promise<FailurePresentationJourneyResult> {
  const task = RECORDED_TASKS[options.task ?? DEFAULTS.task];
  const flow = { flowId: options.flowId ?? DEFAULTS.flowId, flowName: options.flowName ?? DEFAULTS.flowName };
  const timeline = journeyTimeline();
  return withJourneyCore(config, async core => {
    const recorded = await withJourneyBrowser(core, { evidenceId: "ui-e2e-failure-record", scenarioPath: task.scenarioPath }, session => recordTaskFlow(session, task, flow));
    timeline.mark("task-flow-recorded");
    return withJourneyBrowser(core, { evidenceId: "ui-e2e-failure-presentation", scenarioPath: task.scenarioPath }, session => failurePresentationJourney(session, task, recorded, timeline));
  });
}

/** The drifted run and its presentation, inside a session whose Scenario Lab has not yet seen the task completed. */
export async function failurePresentationJourney(session: JourneySession, task: RecordedTask, recorded: DemoWorkspaceState & { latestRecordingId: string }, timeline = journeyTimeline()): Promise<FailurePresentationJourneyResult> {
  const { control, panelPage, scenarioPage, evidence, config } = session;
  const manifest = await loadScenarioManifest(config.repositoryRoot, task.scenarioId);
  const oracle = manifest.expected.finalState ?? [];
  if (oracle.length === 0) throw new RunnerFailure("fixture.invalid", "The task's scenario declares no final-state oracle", { details: { reasonCode: "failure.oracle_missing" } });
  const probe = playwrightScenarioFactProbe(scenarioPage);
  if (await oracleHolds(oracle, probe)) {
    throw new RunnerFailure("fixture.invalid", "The page already shows its oracle before the drifted run", { details: { reasonCode: "failure.scenario_not_fresh" } });
  }
  const connection = await connectExtensionForProject(session, recorded);
  await task.armDrift(scenarioPage, evidence);
  timeline.mark("drift-armed", { sessionReset: connection.sessionReset });

  await openProjectInPanel(panelPage, config.origin, recorded.projectName, evidence);
  await openFlowInCurrentProject(panelPage, recorded.flowName, evidence);
  const execution = await runDemoFlowFromPanel(panelPage, recorded, evidence);
  if (execution.status === "succeeded") {
    throw new RunnerFailure("runtime.behavior", "The recorded Flow succeeded on the drifted page, so there was no failure to present", { details: { reasonCode: "failure.not_reproduced", task: task.id } });
  }
  if (execution.status !== "failed") {
    throw new RunnerFailure("runtime.behavior", "The drifted run ended in a status other than failed", { details: { reasonCode: "failure.status_unexpected", status: execution.status } });
  }
  timeline.mark("run-failed");
  const detail = await failedRunDetail(control, recorded.projectId, execution.runId);
  const activity = assertProviderFreeRun(detail);
  const raw = await rawFailure(control, recorded.projectId, execution.runId);
  const presentation = await readFailedRunPresentation(panelPage, {
    runId: execution.runId,
    attemptCount: detail.actionAttempts.length,
    failedNodeIds: detail.actionAttempts.filter(attempt => attempt.status === "failed").sort((left, right) => left.order - right.order).map(attempt => attempt.nodeId),
    terminalFailureReason: raw.terminalFailureReason,
  });
  timeline.mark("failure-presented", { attemptRows: presentation.attemptRows, failedAttemptRows: presentation.failedAttemptRows });
  if (await oracleHolds(oracle, probe)) throw new RunnerFailure("runtime.behavior", "The page reached its oracle although the run failed", { details: { reasonCode: "failure.oracle_reached" } });
  await task.resetDrift(scenarioPage, evidence).catch(/* best-effort: the session's Scenario Lab is discarded with it, so the drift ends either way */ () => undefined);
  return {
    journey: "failure_presentation",
    status: "verified",
    task: task.id,
    ids: { projectId: recorded.projectId, flowId: recorded.flowId, recordingId: recorded.latestRecordingId, runId: execution.runId },
    run: { actionAttempts: detail.actionAttempts.length, failedAttempts: presentation.failedAttemptRows, failureCategory: raw.failureCategory, failureCode: raw.failureCode, providerCalls: activity.providerCalls },
    presentation,
    oracleReached: false,
    saved: { label: "failure", scenarioId: task.scenarioId, scenarioPath: task.scenarioPath, state: recorded, judge: { kind: "final_state" } },
    checkpoints: timeline.checkpoints,
  };
}

async function oracleHolds(oracle: Parameters<typeof assertExpectedFacts>[0], probe: ReturnType<typeof playwrightScenarioFactProbe>): Promise<boolean> {
  return assertExpectedFacts(oracle, probe).then(() => true, () => false);
}

/** The run's detail once Core has it as failed with at least one failed attempt. */
async function failedRunDetail(control: ExistingFluxIQControlClient, projectId: string, runId: string): Promise<ExistingRunDetail> {
  const deadline = Date.now() + RUN_DETAIL_TIMEOUT_MS;
  let detail = await control.getRunDetail(projectId, runId);
  while (Date.now() < deadline && (detail.summary.status !== "failed" || !detail.actionAttempts.some(attempt => attempt.status === "failed"))) {
    await new Promise(resolve => setTimeout(resolve, 200));
    detail = await control.getRunDetail(projectId, runId);
  }
  if (detail.summary.status !== "failed" || !detail.actionAttempts.some(attempt => attempt.status === "failed")) {
    throw new RunnerFailure("runtime.behavior", "Core did not record the drifted run's failed attempt", { details: { reasonCode: "failure.attempt_missing", actionAttempts: detail.actionAttempts.length } });
  }
  return detail;
}

/** Core's terminal reason and the first failed attempt's failure record, read from the raw run detail. The code is kept only when it has the shape of one. */
async function rawFailure(control: ExistingFluxIQControlClient, projectId: string, runId: string): Promise<{ terminalFailureReason: string | undefined; failureCategory: string | null; failureCode: string | null }> {
  const payload = await control.automationStudioCall("get-flow-run-detail", { projectId, runId }) as { runDetail?: { metadata?: { terminalFailureReason?: unknown }; actionAttempts?: unknown[] } };
  const reason = payload.runDetail?.metadata?.terminalFailureReason;
  const attempts = (Array.isArray(payload.runDetail?.actionAttempts) ? payload.runDetail!.actionAttempts! : []) as Array<{ status?: unknown; order?: unknown; failure?: unknown }>;
  const failed = attempts.filter(attempt => attempt.status === "failed").sort((left, right) => Number(left.order ?? 0) - Number(right.order ?? 0))[0];
  const failure = failed ? parseAutomationStudioFailureRecord(failed.failure) : undefined;
  const code = failure && typeof failure.code === "string" && /^[a-z][a-z0-9_.-]{0,79}$/iu.test(failure.code) ? failure.code : null;
  return { terminalFailureReason: typeof reason === "string" ? reason : undefined, failureCategory: failure?.category ?? null, failureCode: code };
}
