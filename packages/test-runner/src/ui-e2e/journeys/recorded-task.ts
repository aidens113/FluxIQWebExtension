// A small task recorded by demonstration through the real extension and turned
// into a Flow by the panel's Generate Subflow: the provider-free way to own a
// working Flow that a fixture's own drift control can then break. The failure
// journey runs the drifted page; the restart journey reruns the baseline one.
//
// Two tasks, each on a fixture that offers its drift as buttons on the page:
//
// - `missing-target` (`llm-target-drift`): click the recorded target; the
//   drift removes that target from the page. Nothing is left to resolve, so a
//   deterministic run must fail -- the fixture calls it "deterministic failure
//   armed".
// - `redesigned-field` (`instruction-only-form`): type a name, choose a plan,
//   submit; the drift redesigns the name input as a textarea under a new test
//   id. Measured on t069, a recorded Flow *survives* this drift: the
//   extension's deterministic target scoring finds the redesigned field by its
//   label, and the run succeeds. It is kept so the journey reports that as
//   `failure.not_reproduced` rather than hiding it.
//
// The demonstrated values are the ones each scenario's oracle names, so a
// recorded Flow reaches that oracle on the baseline page.
import type { Page } from "@playwright/test";
import type { BrowserEvidenceRecorder } from "../../browser-evidence.js";
import { RunnerFailure } from "../../failure.js";
import {
  type DemoFlowProfile, type DemoWorkspaceState, generateDemoSubflowFromRecording, pollStatus,
  provisionDemoFlow, recordingIds, waitForNewRecording,
} from "../../demo-workspace/index.js";
import { selectOptionByKeyboard } from "../../trusted-input/index.js";
import { connectExtensionForProject } from "./extension-project.js";
import { JOURNEY_RECORDING_FINALIZE_TIMEOUT_MS, journeyFlowConfiguration, type JourneySession } from "./session.js";

export type RecordedTaskId = "missing-target" | "redesigned-field";

export type RecordedTask = Readonly<{
  id: RecordedTaskId;
  scenarioId: string;
  scenarioPath: string;
  /** The actions a recording of the task must generate; a navigation or scroll the recorder observed may come with them. */
  requiredOutputs: readonly string[];
  /** Performs the task on the baseline page and waits until the page shows it done. */
  demonstrate(page: Page, evidence: BrowserEvidenceRecorder): Promise<void>;
  /** Arms the fixture's drift through its own page control and waits for the page to show it. */
  armDrift(page: Page, evidence: BrowserEvidenceRecorder): Promise<void>;
  /** Restores the baseline page. */
  resetDrift(page: Page, evidence: BrowserEvidenceRecorder): Promise<void>;
}>;

async function waitForText(page: Page, testId: string, text: string, reasonCode: string): Promise<void> {
  await page.getByTestId(testId).filter({ hasText: text }).waitFor({ timeout: 10_000 }).catch(() => {
    throw new RunnerFailure("runtime.behavior", "The scenario page did not reach the state the step waits for", { details: { reasonCode } });
  });
}

export const RECORDED_TASKS: Readonly<Record<RecordedTaskId, RecordedTask>> = {
  "missing-target": {
    id: "missing-target",
    scenarioId: "llm-target-drift",
    scenarioPath: "/scenarios/llm-target-drift/",
    requiredOutputs: ["web.dom.click"],
    async demonstrate(page, evidence) {
      await evidence.step("scenario", "task-activate-target", "Activate the target", () => page.getByTestId("diagnosis-target").click());
      await waitForText(page, "result", "Completed: 1", "task.demonstration_failed");
    },
    async armDrift(page, evidence) {
      await evidence.step("scenario", "task-arm-drift", "Remove the recorded target", () => page.getByTestId("introduce-missing-target").click());
      await waitForText(page, "drift-mode", "Mode: missing", "task.drift_not_armed");
    },
    async resetDrift(page, evidence) {
      await evidence.step("scenario", "task-reset-drift", "Restore the recorded target", () => page.getByTestId("restore-target").click());
    },
  },
  "redesigned-field": {
    id: "redesigned-field",
    scenarioId: "instruction-only-form",
    scenarioPath: "/scenarios/instruction-only-form/",
    requiredOutputs: ["web.dom.type", "web.dom.select", "web.dom.click"],
    async demonstrate(page, evidence) {
      await evidence.step("scenario", "task-fill-name", "Type the name", () => page.getByTestId("instruction-name").fill("Ada"));
      await evidence.step("scenario", "task-select-plan", "Choose the plan", () => selectOptionByKeyboard(page.getByTestId("instruction-plan"), "team"));
      await evidence.step("scenario", "task-submit", "Submit the form", () => page.getByTestId("instruction-submit").click());
      await waitForText(page, "result", "Submitted: Ada / team", "task.demonstration_failed");
    },
    async armDrift(page, evidence) {
      await evidence.step("scenario", "task-arm-drift", "Introduce the form's target drift", () => page.getByTestId("instruction-introduce-target-drift").click());
      await waitForText(page, "instruction-target-drift-status", "Target mode: drifted", "task.drift_not_armed");
    },
    async resetDrift(page, evidence) {
      await evidence.step("scenario", "task-reset-drift", "Reset the form's target drift", () => page.getByTestId("instruction-reset-target-drift").click());
    },
  },
};

/** Provisions the Flow in the task's own project, records `task` into it, and generates its Subflow. */
export async function recordTaskFlow(session: JourneySession, task: RecordedTask, flow: { flowId: string; flowName: string }): Promise<DemoWorkspaceState & { latestRecordingId: string }> {
  const { control, extensionPage, panelPage, scenarioPage, evidence } = session;
  const config = journeyFlowConfiguration(session.config, `failure-${task.id}`, flow);
  const profile = recordedTaskProfile(task);
  const provisioned = await provisionDemoFlow(control, config, panelPage, evidence, profile);
  const before = recordingIds(await control.listRecordings(provisioned.projectId));
  await connectExtensionForProject(session, provisioned);
  await evidence.step("scenario", "task-focus-scenario", "Focus the scenario before recording", () => scenarioPage.bringToFront());
  await scenarioPage.waitForTimeout(750);
  let recording = false;
  try {
    await evidence.step("extension", "task-record-start", "Start extension recording", async () => {
      await extensionPage.getByRole("button", { name: "Start recording" }).click();
      await pollStatus(extensionPage, value => value.recordingState === "recording" && value.projectId === provisioned.projectId, "task recording acceptance");
    });
    recording = true;
    await task.demonstrate(scenarioPage, evidence);
    await evidence.step("extension", "task-record-stop", "Stop extension recording", async () => {
      await extensionPage.getByRole("button", { name: "Stop recording" }).click();
      await pollStatus(extensionPage, value => value.recordingState === "idle", "task recording stop");
    });
    recording = false;
  } finally {
    if (recording) await extensionPage.getByRole("button", { name: "Stop recording" }).click().catch(/* best-effort: the journey is already failing, and a recorder left running must not replace its error */ () => undefined);
  }
  const recordingId = await waitForNewRecording(control, provisioned.projectId, before, { timeoutMs: JOURNEY_RECORDING_FINALIZE_TIMEOUT_MS });
  const generated = await generateDemoSubflowFromRecording(panelPage, control, config, provisioned, recordingId, evidence, profile);
  return { ...generated, latestRecordingId: recordingId };
}

/**
 * A recording-generated Subflow for `task`: ordinary policy actions carrying
 * the recording as evidence, holding every required action and nothing but
 * those, a navigation, and a scroll.
 */
export function assertRecordedTaskFlow(task: RecordedTask, document: Record<string, unknown>, recordingId?: string): void {
  const nodes = Array.isArray(document.nodes) ? document.nodes as Array<Record<string, any>> : [];
  const outputs = nodes.map(node => String(node.parameterValues?.outputId ?? ""));
  const allowed = new Set([...task.requiredOutputs, "web.browser.navigate", "web.dom.scroll"]);
  const valid = nodes.length >= task.requiredOutputs.length && nodes.length <= task.requiredOutputs.length + 3
    && task.requiredOutputs.every(output => outputs.includes(output))
    && outputs.every(output => allowed.has(output))
    && nodes.every(node => node.definitionId === "builtin.policy.action"
      && (!recordingId || Array.isArray(node.metadata?.evidence) && node.metadata.evidence.some((item: any) => item?.artifactId === recordingId)));
  if (!valid) throw new RunnerFailure("runtime.behavior", "The generated Subflow is not the recorded task", { details: { reasonCode: "task.generated_flow_shape", task: task.id, nodeCount: nodes.length } });
}

function recordedTaskProfile(task: RecordedTask): DemoFlowProfile {
  const counts = Array.from({ length: 4 }, (_unused, extra) => task.requiredOutputs.length + extra);
  return {
    // Named for this journey alone; see `journeyFlowConfiguration` in `session.ts`.
    subflowName: "Recorded task steps",
    useSavedWorkspaceState: false,
    persistWorkspaceState: false,
    assertRecordingDerivedFlow: (document, recordingId) => assertRecordedTaskFlow(task, document, recordingId),
    renderedNodeCounts: counts,
  };
}
