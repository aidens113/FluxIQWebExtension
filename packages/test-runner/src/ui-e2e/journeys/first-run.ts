// Journey F1: record, Generate Subflow, run, and watch Runtime Debug.
//
// A task is recorded by demonstration through the real extension and turned
// into a Flow by the panel's Generate Subflow (`recordTaskFlow`, which checks
// the generated graph's shape and provenance). A second browser session on the
// same Core -- whose Scenario Lab has not seen the task done -- runs that Flow
// from the panel under No LLM intervention. The run must succeed, the page must
// then show the scenario's final-state oracle, Core must record no model
// activity, and Runtime Debug must show it: the run row and the Action Log with
// Core's run id, status, action count and attempt rows
// (`assertRuntimeDebugRun`).
import { RunnerFailure } from "../../failure.js";
import { type DemoWorkspaceConfiguration, type DemoWorkspaceState, openFlowInCurrentProject, openProjectInPanel, runDemoFlowFromPanel } from "../../demo-workspace/index.js";
import { assertExpectedFacts, playwrightScenarioFactProbe } from "../../scenario-assertions.js";
import { loadScenarioManifest } from "../../scenarios.js";
import { assertRuntimeDebugRun, type RuntimeDebugAssertion } from "../assertions/index.js";
import { connectExtensionForProject } from "./extension-project.js";
import { assertProviderFreeRun, type RunModelActivity } from "./provider-free-run.js";
import { RECORDED_TASKS, type RecordedTask, recordTaskFlow } from "./recorded-task.js";
import { type JourneySession, withJourneyBrowser, withJourneyCore } from "./session.js";
import { type JourneyCheckpoint, journeyTimeline } from "./timeline.js";

export type FirstRunJourneyResult = Readonly<{
  journey: "first_run";
  status: "verified";
  ids: Readonly<{ projectId: string; flowId: string; recordingId: string; runId: string }>;
  activity: RunModelActivity;
  runtimeDebug: RuntimeDebugAssertion;
  checkpoints: readonly JourneyCheckpoint[];
}>;

const FLOW = { flowId: "flow.ui-e2e-first-run", flowName: "UI E2E First Run" } as const;
/** `missing-target` is recorded on the baseline page and run there; its drift is never armed here. */
const TASK: RecordedTask = RECORDED_TASKS["missing-target"];

/** Records the task's Flow in one browser session and runs it, watched in Runtime Debug, in a second, on one Core. */
export async function runFirstRunJourney(config: DemoWorkspaceConfiguration): Promise<FirstRunJourneyResult> {
  const timeline = journeyTimeline();
  return withJourneyCore(config, async core => {
    const recorded = await withJourneyBrowser(core, { evidenceId: "ui-e2e-first-run-record", scenarioPath: TASK.scenarioPath }, session => recordTaskFlow(session, TASK, FLOW, "first-run"));
    timeline.mark("task-flow-recorded");
    return withJourneyBrowser(core, { evidenceId: "ui-e2e-first-run", scenarioPath: TASK.scenarioPath }, session => firstRunJourney(session, recorded, timeline));
  });
}

async function firstRunJourney(session: JourneySession, recorded: DemoWorkspaceState & { latestRecordingId: string }, timeline: ReturnType<typeof journeyTimeline>): Promise<FirstRunJourneyResult> {
  const { control, panelPage, scenarioPage, evidence, config } = session;
  const manifest = await loadScenarioManifest(config.repositoryRoot, TASK.scenarioId);
  const oracle = manifest.expected.finalState ?? [];
  if (oracle.length === 0) throw new RunnerFailure("fixture.invalid", "The task's scenario declares no final-state oracle", { details: { reasonCode: "first_run.oracle_missing" } });
  await connectExtensionForProject(session, recorded);
  await openProjectInPanel(panelPage, config.origin, recorded.projectName, evidence);
  await openFlowInCurrentProject(panelPage, recorded.flowName, evidence);
  const execution = await runDemoFlowFromPanel(panelPage, recorded, evidence);
  if (execution.status !== "succeeded") {
    throw new RunnerFailure("runtime.behavior", "The recorded Flow did not succeed on the page it was recorded on", { details: { reasonCode: "first_run.not_succeeded", status: execution.status } });
  }
  timeline.mark("run-succeeded");
  const runtimeDebug = await assertRuntimeDebugRun({ page: panelPage, control, projectId: recorded.projectId, runId: execution.runId });
  if (runtimeDebug.code !== "runtime_debug.verified") {
    throw new RunnerFailure("runtime.behavior", "Runtime Debug did not show the run as Core recorded it", { details: { reasonCode: runtimeDebug.code } });
  }
  timeline.mark("runtime-debug-verified", { attemptRows: runtimeDebug.reopenedLog.attemptRows });
  const activity = assertProviderFreeRun(await control.getRunDetail(recorded.projectId, execution.runId));
  await assertExpectedFacts(oracle, playwrightScenarioFactProbe(scenarioPage)).catch((error: unknown) => {
    throw new RunnerFailure("runtime.behavior", "The page did not reach its final-state oracle after the run succeeded", { details: { reasonCode: "first_run.oracle_not_reached" }, cause: error });
  });
  timeline.mark("oracle-reached");
  return {
    journey: "first_run",
    status: "verified",
    ids: { projectId: recorded.projectId, flowId: recorded.flowId, recordingId: recorded.latestRecordingId, runId: execution.runId },
    activity,
    runtimeDebug,
    checkpoints: timeline.checkpoints,
  };
}
