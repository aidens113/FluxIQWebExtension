// Journey D: pick and extract data, then Flow, then Run, then the dataset
// preview and export, all through the real extension and panel.
//
// A person opens the extension's "Extract Data From This Page", clicks one
// example item, keeps the columns the task wants, and confirms while the
// extension records. The panel's Generate Subflow turns the recording into a
// Flow, and the panel runs it with No LLM intervention. The journey passes
// only when the dataset that run stored answers the scenario's record oracle
// -- `matchedRecords === expectedRecords` -- and the panel shows the stored
// rows and hands out non-empty CSV and JSON exports.
import { loadScenarioManifest } from "../../scenarios.js";
import { RunnerFailure } from "../../failure.js";
import {
  assertConnectedSession, type DemoFlowProfile, type DemoWorkspaceConfiguration, extensionStatus,
  generateDemoSubflowFromRecording, openFlowInCurrentProject, pollStatus, provisionDemoFlow, recordingIds, runDemoFlowFromPanel,
  waitForNewRecording, waitForRoutedRunDetail,
} from "../../demo-workspace/index.js";
import { assertDatasetJudgement, type DatasetJudgement, judgeStoredDataset, readSingleRunDataset } from "./dataset-judgement.js";
import { type DatasetPanelResult, verifyRunDatasetPanel } from "./dataset-panel.js";
import { connectExtensionForProject } from "./extension-project.js";
import { type FieldReviewSummary, reviewPickedFields } from "./field-review.js";
import { assertProviderFreeRun } from "./provider-free-run.js";
import type { SavedJourneyFlow } from "./saved-flow.js";
import { JOURNEY_RECORDING_FINALIZE_TIMEOUT_MS, journeyFlowConfiguration, type JourneySession, withJourneyBrowser, withJourneyCore } from "./session.js";
import { type JourneyCheckpoint, journeyTimeline } from "./timeline.js";

export type ExtractionJourneyOptions = Readonly<{
  /** The scenario whose first page is extracted and whose record oracle judges it. */
  scenarioId?: string;
  /** The test id of the item clicked as the example. */
  exampleItemTestId?: string;
  flowId?: string;
  flowName?: string;
}>;

export type ExtractionJourneyResult = Readonly<{
  journey: "extraction";
  status: "verified";
  scenarioId: string;
  ids: Readonly<{ projectId: string; flowId: string; subflowId: string; graphFlowId: string; recordingId: string; runId: string; datasetId: string }>;
  picker: FieldReviewSummary & Readonly<{ proposedItems: number; capturedRecords: number }>;
  run: Readonly<{ actionAttempts: number; providerCalls: number; interventions: number }>;
  judgement: Omit<DatasetJudgement, "datasetId">;
  panel: DatasetPanelResult;
  /** What the restart journey needs to find this Flow again and rerun it. */
  saved: SavedJourneyFlow;
  checkpoints: readonly JourneyCheckpoint[];
}>;

const DEFAULTS = { scenarioId: "product-catalog", exampleItemTestId: "product-card", flowId: "flow.ui-e2e-extraction", flowName: "UI E2E Extraction" } as const;

/** Runs the journey on its own Core and browser session. */
export async function runExtractionJourney(config: DemoWorkspaceConfiguration, options: ExtractionJourneyOptions = {}): Promise<ExtractionJourneyResult> {
  const scenarioId = options.scenarioId ?? DEFAULTS.scenarioId;
  const manifest = await loadScenarioManifest(config.repositoryRoot, scenarioId);
  return withJourneyCore(config, core => withJourneyBrowser(core, { evidenceId: "ui-e2e-extraction", scenarioPath: manifest.startPath }, session => extractionJourney(session, options)));
}

/** The journey inside a running session whose scenario page shows the scenario's start page. */
export async function extractionJourney(session: JourneySession, options: ExtractionJourneyOptions = {}): Promise<ExtractionJourneyResult> {
  const { control, extensionPage, panelPage, scenarioPage, scenarioUrl, evidence } = session;
  const timeline = journeyTimeline();
  const scenarioId = options.scenarioId ?? DEFAULTS.scenarioId;
  const manifest = await loadScenarioManifest(session.config.repositoryRoot, scenarioId);
  const entry = manifest.expected.extracted?.[0];
  if (!entry?.records) throw new RunnerFailure("fixture.invalid", "The extraction journey's scenario lists no expected records", { details: { reasonCode: "extraction.oracle_missing" } });
  const context = { scenarioOrigin: new URL(scenarioUrl).origin };
  const config = journeyFlowConfiguration(session.config, "extraction", { flowId: options.flowId ?? DEFAULTS.flowId, flowName: options.flowName ?? DEFAULTS.flowName });

  const provisioned = await provisionDemoFlow(control, config, panelPage, evidence, EXTRACTION_FLOW_PROFILE);
  timeline.mark("flow-provisioned");
  const before = recordingIds(await control.listRecordings(provisioned.projectId));
  const connection = await connectExtensionForProject(session, provisioned);
  timeline.mark("extension-connected", { sessionReset: connection.sessionReset });

  await evidence.step("scenario", "extraction-focus-scenario", "Focus the scenario before recording", () => scenarioPage.bringToFront());
  await scenarioPage.waitForTimeout(500);
  let recording = false;
  let picked: { proposedItems: number; capturedRecords: number; review: FieldReviewSummary };
  try {
    await evidence.step("extension", "extraction-record-start", "Start extension recording", async () => {
      await extensionPage.getByRole("button", { name: "Start recording" }).click();
      await pollStatus(extensionPage, value => value.recordingState === "recording" && value.projectId === provisioned.projectId, "extraction recording acceptance");
    });
    recording = true;
    picked = await pickAndConfirm(session, { exampleItemTestId: options.exampleItemTestId ?? DEFAULTS.exampleItemTestId, expected: entry.records, ...(entry.optionalFields ? { optionalFields: entry.optionalFields } : {}), context });
    timeline.mark("extraction-confirmed", { proposedItems: picked.proposedItems, capturedRecords: picked.capturedRecords });
    await evidence.step("extension", "extraction-record-stop", "Stop extension recording", async () => {
      await extensionPage.getByRole("button", { name: "Stop recording" }).click();
      await pollStatus(extensionPage, value => value.recordingState === "idle", "extraction recording stop");
    });
    recording = false;
  } finally {
    if (recording) await extensionPage.getByRole("button", { name: "Stop recording" }).click().catch(/* best-effort: the journey is already failing, and a recorder left running must not replace its error */ () => undefined);
  }
  const recordingId = await waitForNewRecording(control, provisioned.projectId, before, { timeoutMs: JOURNEY_RECORDING_FINALIZE_TIMEOUT_MS });
  timeline.mark("recording-saved");
  const state = { ...await generateDemoSubflowFromRecording(panelPage, control, config, provisioned, recordingId, evidence, EXTRACTION_FLOW_PROFILE), latestRecordingId: recordingId };
  timeline.mark("flow-generated");

  await openFlowInCurrentProject(panelPage, state.flowName, evidence);
  const execution = await runDemoFlowFromPanel(panelPage, state, evidence);
  if (execution.status !== "succeeded") {
    throw new RunnerFailure("runtime.behavior", "The generated extraction Flow did not succeed when run from the panel", { details: { reasonCode: "run.not_succeeded", status: execution.status } });
  }
  const detail = await waitForRoutedRunDetail(control, state, execution.runId, 1);
  if (detail.actionAttempts.length !== 1 || detail.actionAttempts.some(action => action.status !== "succeeded")) {
    throw new RunnerFailure("runtime.behavior", "The extraction run did not succeed at exactly its one action", { details: { reasonCode: "run.attempts_invalid", actionAttempts: detail.actionAttempts.length } });
  }
  const activity = assertProviderFreeRun(detail);
  timeline.mark("run-succeeded");

  const dataset = await readSingleRunDataset(control, { projectId: state.projectId, runId: execution.runId });
  const judged = judgeStoredDataset(dataset, entry, context);
  await evidence.diagnostic("panel", "extraction-judgement", "ui-e2e.extraction.judgement", { expectedRecords: judged.expectedRecords, observedRecords: judged.observedRecords, matchedRecords: judged.matchedRecords, presentFields: judged.presentFields, expectedFields: judged.expectedFields });
  assertDatasetJudgement(judged);
  timeline.mark("records-judged", { expectedRecords: judged.expectedRecords, matchedRecords: judged.matchedRecords });

  const panel = await verifyRunDatasetPanel(panelPage, evidence, dataset);
  timeline.mark("panel-verified", { previewRows: panel.previewRows, csvBytes: panel.csvBytes, jsonBytes: panel.jsonBytes });
  await assertConnectedSession(control, (await extensionStatus(extensionPage)).sessionId);

  const { datasetId, ...judgement } = judged;
  return {
    journey: "extraction",
    status: "verified",
    scenarioId,
    ids: { projectId: state.projectId, flowId: state.flowId, subflowId: state.subflowId, graphFlowId: state.graphFlowId, recordingId, runId: execution.runId, datasetId },
    picker: { ...picked.review, proposedItems: picked.proposedItems, capturedRecords: picked.capturedRecords },
    run: { actionAttempts: detail.actionAttempts.length, providerCalls: activity.providerCalls, interventions: activity.interventions },
    judgement,
    panel,
    saved: { label: "extraction", scenarioId, scenarioPath: manifest.startPath, state: { ...state, latestRuntimeRunId: execution.runId }, judge: { kind: "dataset", sha256: judged.sha256, records: judged.observedRecords } },
    checkpoints: timeline.checkpoints,
  };
}

/**
 * The picker, from "Extract Data From This Page" to the confirmation's
 * captured count. The scenario page stays in front while the extension is
 * driven: foregrounding the extension page makes the active tab unsupported
 * and disables Stop recording (`w2-extraction-exit-live.md`).
 */
async function pickAndConfirm(session: JourneySession, input: { exampleItemTestId: string; expected: Parameters<typeof reviewPickedFields>[2]["expected"]; optionalFields?: readonly string[]; context: { scenarioOrigin: string } }): Promise<{ proposedItems: number; capturedRecords: number; review: FieldReviewSummary }> {
  const { extensionPage, scenarioPage, evidence } = session;
  await evidence.step("extension", "extraction-open-picker", "Open Extract Data From This Page", () => extensionPage.getByRole("button", { name: "Extract Data From This Page", exact: true }).click());
  await extensionPage.getByText("Click one example item on the page -- a product, a row, a card. FluxIQ finds the rest.", { exact: true }).waitFor();
  await scenarioPage.bringToFront();
  await evidence.step("scenario", "extraction-pick-example", "Click one example item", () => scenarioPage.getByTestId(input.exampleItemTestId).first().click({ position: { x: 6, y: 6 } }));
  await extensionPage.getByText("Check the columns, then confirm.", { exact: true }).waitFor({ timeout: 30_000 }).catch(() => {
    throw new RunnerFailure("runtime.behavior", "The picker did not propose a repeating structure for the example item", { details: { reasonCode: "extraction.no_proposal" } });
  });
  const proposedItems = await extensionPage.locator("#extractionSummary").evaluate(element => Number.parseInt(element.textContent ?? "", 10));
  if (!Number.isSafeInteger(proposedItems) || proposedItems !== input.expected.length) {
    throw new RunnerFailure("runtime.behavior", "The picker proposed a different number of items than the page holds", { details: { reasonCode: "extraction.item_count", proposedItems: Number.isSafeInteger(proposedItems) ? proposedItems : -1, expectedRecords: input.expected.length } });
  }
  const review = await reviewPickedFields(extensionPage, evidence, { expected: input.expected, ...(input.optionalFields ? { optionalFields: input.optionalFields } : {}), context: input.context });
  await evidence.step("extension", "extraction-confirm", "Confirm the reviewed extraction", () => extensionPage.getByRole("button", { name: "Confirm", exact: true }).click());
  const captured = extensionPage.getByText(/^Captured \d+ records? into /u);
  await captured.waitFor({ timeout: 30_000 }).catch(() => {
    throw new RunnerFailure("runtime.behavior", "The extension did not confirm the capture", { details: { reasonCode: "extraction.capture_unconfirmed" } });
  });
  const capturedRecords = Number.parseInt(/^Captured (\d+)/u.exec(await captured.innerText())?.[1] ?? "", 10);
  if (capturedRecords !== proposedItems) {
    throw new RunnerFailure("runtime.behavior", "The confirmation captured a different number of records than the picker proposed", { details: { reasonCode: "extraction.capture_count", proposedItems, capturedRecords: Number.isSafeInteger(capturedRecords) ? capturedRecords : -1 } });
  }
  await evidence.step("extension", "extraction-close", "Close the confirmed extraction panel", () => extensionPage.locator("#extractionCloseButton").click());
  return { proposedItems, capturedRecords, review };
}

/** A recording-generated extraction Subflow: one policy action writing `web.dom.extract_list`, carrying the recording as evidence. */
export function assertExtractionRecordingDerivedFlow(document: Record<string, unknown>, recordingId?: string): void {
  const nodes = Array.isArray(document.nodes) ? document.nodes as Array<Record<string, any>> : [];
  const edges = Array.isArray(document.edges) ? document.edges : [];
  const valid = nodes.length === 1 && edges.length === 0 && nodes.every(node => node.definitionId === "builtin.policy.action"
    && node.parameterValues?.outputId === "web.dom.extract_list"
    && (!recordingId || Array.isArray(node.metadata?.evidence) && node.metadata.evidence.some((item: any) => item?.artifactId === recordingId)));
  if (!valid) throw new RunnerFailure("runtime.behavior", "The generated Subflow is not one recorded extraction", { details: { reasonCode: "extraction.generated_flow_shape", nodeCount: nodes.length, edgeCount: edges.length } });
}

// Each journey names its Subflow for itself: the panel finds a Subflow by a
// hierarchy search on its name, and two Subflows sharing a name open whichever
// the search lists first.
const EXTRACTION_FLOW_PROFILE: DemoFlowProfile = {
  subflowName: "Extraction steps",
  useSavedWorkspaceState: false,
  persistWorkspaceState: false,
  assertRecordingDerivedFlow: assertExtractionRecordingDerivedFlow,
  renderedNodeCounts: [1],
};
