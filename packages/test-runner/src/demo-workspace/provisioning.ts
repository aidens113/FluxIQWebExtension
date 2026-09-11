// Provisioning a demo Flow through the panel: the profile that varies between
// the standard demo and the diagnosis fixture, and the Subflow generated from
// a recording.
import type { Page } from "@playwright/test";
import { BrowserEvidenceRecorder } from "../browser-evidence.js";
import { ExistingFluxIQControlClient } from "../existing-fluxiq-control.js";
import { RunnerFailure } from "../failure.js";
import type { DemoWorkspaceConfiguration } from "./configuration.js";
import { waitForNamedFlow, waitForNamedSubflow } from "./control-waits.js";
import { assertDemoParentDocument, assertDemoRecordingDerivedFlow, assertDemoSubflowOwnership, isDemoFixtureDocument, isEmptyDemoFlow } from "./flow-document.js";
import { hierarchyRow, openAutomationStudio, openFlowInCurrentProject, openProjectInPanel, openSubflowInCurrentProject } from "./panel-navigation.js";
import { assertDemoFlowRenderedLayout, waitForPanelMutationResponse } from "./panel-run.js";
import { configureDemoRouterFallbackInPanel, createDemoSubflowInPanel } from "./subflow-authoring.js";
import { type DemoWorkspaceState, SCHEMA_VERSION, loadWorkspaceState, saveWorkspaceState } from "./workspace-state.js";

export const DEMO_SUBFLOW_NAME = "Primary browser automation";

export type DemoFlowProfile = {
  subflowName: string;
  useSavedWorkspaceState: boolean;
  persistWorkspaceState: boolean;
  assertRecordingDerivedFlow: (document: Record<string, unknown>, recordingId?: string) => void;
  renderedNodeCounts: readonly number[];
};

export const STANDARD_DEMO_FLOW_PROFILE: DemoFlowProfile = {
  subflowName: DEMO_SUBFLOW_NAME,
  useSavedWorkspaceState: true,
  persistWorkspaceState: true,
  assertRecordingDerivedFlow: assertDemoRecordingDerivedFlow,
  renderedNodeCounts: [4, 5],
};

export async function provisionDemoFlow(control: ExistingFluxIQControlClient, config: DemoWorkspaceConfiguration, panelPage: Page, evidence: BrowserEvidenceRecorder, profile: DemoFlowProfile = STANDARD_DEMO_FLOW_PROFILE): Promise<DemoWorkspaceState> {
  const saved = profile.useSavedWorkspaceState ? await loadWorkspaceState(config) : undefined;
  const projects = await control.listProjects("web-automation");
  const requestedId = config.projectId ?? saved?.projectId;
  let project = requestedId ? projects.find(item => item.id === requestedId) : undefined;
  if (requestedId && !project) throw new RunnerFailure("environment.missing", "Configured demo project is not accessible");
  if (!project) {
    const named = projects.filter(item => item.name === config.projectName && item.domainId === "web-automation");
    if (named.length > 1) {
      throw new RunnerFailure("environment.missing", "More than one matching demo project exists; set FLUXIQ_DEMO_PROJECT_ID");
    }
    project = named[0];
  }
  if (!project) {
    await openAutomationStudio(panelPage, config.origin, evidence);
    await evidence.step("panel", "project-create-open", "Open the Create project dialog", () => panelPage.getByRole("button", { name: "Project", exact: true }).click());
    const dialog = panelPage.getByRole("dialog", { name: "Create project" });
    if (!await dialog.isVisible().catch(() => false)) {
      await dialog.waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);
    }
    if (!await dialog.isVisible().catch(() => false)) {
      await evidence.step("panel", "project-create-open-retry", "Retry opening Create project after panel hydration", () => panelPage.getByRole("button", { name: "Project", exact: true }).click());
      await dialog.waitFor({ state: "visible", timeout: 30_000 });
    }
    await evidence.step("panel", "project-name", "Enter the demo project name", () => dialog.getByLabel("Project name").fill(config.projectName));
    await evidence.step("panel", "project-description", "Enter the demo project description", () => dialog.getByLabel("Description").fill("Persistent self-recording workspace for the FluxIQ web extension"));
    await evidence.step("panel", "project-pin", "Authorize demo project creation", () => dialog.getByLabel("Security PIN").fill(config.pin), { sensitive: true });
    await evidence.step("panel", "project-create-submit", "Create the demo project", () => dialog.getByRole("button", { name: "Create project" }).click(), { sensitive: true });
    await panelPage.locator(".automation-studio-sidebar-heading").getByText(config.projectName, { exact: true }).waitFor();
    const created = (await control.listProjects("web-automation")).filter(item => item.name === config.projectName);
    if (created.length !== 1) throw new RunnerFailure("environment.missing", "Panel project creation did not produce one web-automation project");
    project = created[0]!;
  }
  if (project.domainId !== "web-automation") {
    throw new RunnerFailure("environment.missing", "Demo project must be bound to the web-automation domain");
  }
  await openProjectInPanel(panelPage, config.origin, project.name, evidence);
  const summaries = await control.listFlowSummaries(project.id);
  const requestedFlowId = saved?.flowId ?? config.flowId;
  let summary = summaries.find(item => item.flowId === requestedFlowId) ?? summaries.find(item => item.name === config.flowName);
  if (!summary) {
    await evidence.step("panel", "flow-create-open", "Open the Add Flow dialog", () => panelPage.getByRole("button", { name: "Add Flow" }).click());
    const dialog = panelPage.getByRole("dialog");
    await evidence.step("panel", "flow-create-kind", "Choose a Flow hierarchy item", () => dialog.getByRole("button", { name: /^Flow/u }).click());
    await evidence.step("panel", "flow-create-name", "Enter the demo Flow name", () => dialog.getByLabel("Name").fill(config.flowName));
    await evidence.step("panel", "flow-create-preset", "Choose the deterministic Flow preset", () => dialog.getByLabel("Flow preset").selectOption("deterministic"));
    await evidence.step("panel", "flow-create-pin", "Authorize demo Flow creation", () => dialog.getByLabel("Security PIN").fill(config.pin), { sensitive: true });
    await evidence.step("panel", "flow-create-submit", "Create the demo Flow", () => dialog.getByRole("button", { name: "Create", exact: true }).click(), { sensitive: true });
    const createdSummary = await waitForNamedFlow(control, project.id, config.flowName);
    summary = createdSummary;
    if (!await hierarchyRow(panelPage, config.flowName).isVisible().catch(() => false)) {
      await evidence.step("panel", "flow-create-refresh", "Refresh the panel after Flow creation", () => panelPage.reload({ waitUntil: "domcontentloaded" }).then(() => undefined));
      await panelPage.locator(".automation-studio-sidebar-heading").getByText(project.name, { exact: true }).waitFor();
      await hierarchyRow(panelPage, config.flowName).waitFor();
    }
  }
  let flow = await control.getExactFlow(project.id, summary.flowId);
  const legacyParentFixture = isDemoFixtureDocument(flow.document, project.id, flow.flowId, config.flowName);
  const parentRepresentationKind = (flow.document.metadata as Record<string, unknown> | undefined)?.flowRepresentationKind;
  const recoverableInterruptedParent = isEmptyDemoFlow(flow.document, project.id, flow.flowId, config.flowName)
    && (parentRepresentationKind === undefined || parentRepresentationKind === "legacy_single_graph");
  if (!legacyParentFixture && !recoverableInterruptedParent) assertDemoParentDocument(flow.document, project.id, flow.flowId, config.flowName);
  const subflows = await control.listFlowSubflows(project.id, flow.flowId);
  const namedSubflows = subflows.filter(item => item.name === profile.subflowName);
  if (namedSubflows.length > 1) throw new RunnerFailure("environment.missing", `More than one demo Subflow named ${profile.subflowName} exists`);
  let subflow = namedSubflows[0];
  if (!subflow) {
    await createDemoSubflowInPanel(panelPage, flow.name, config.pin, evidence, profile.subflowName);
    subflow = await waitForNamedSubflow(control, project.id, flow.flowId, profile.subflowName);
  }
  if (!subflow.graphFlowId) throw new RunnerFailure("environment.missing", "The primary demo Subflow does not own a dedicated graph Flow");
  const graphFlowId = subflow.graphFlowId;
  const graphFlow = await control.getExactFlow(project.id, graphFlowId);
  const graphFlowName = typeof graphFlow.document.name === "string" && graphFlow.document.name.trim() ? graphFlow.document.name : `${profile.subflowName} Graph`;
  assertDemoSubflowOwnership(graphFlow.document, project.id, flow.flowId, subflow.subflowId, graphFlowId);
  const graphFixtureOwned = (graphFlow.document.metadata as Record<string, unknown> | undefined)?.createdBy === "fluxiq-web-extension-demo-workspace";
  if (graphFixtureOwned && isDemoFixtureDocument(graphFlow.document, project.id, graphFlow.flowId, graphFlowName)) {
    const metadata = { ...((graphFlow.document.metadata as Record<string, unknown> | undefined) ?? {}) };
    delete metadata.createdBy;
    await evidence.step("panel", "legacy-fixture-retire", "Retire the exact legacy demo fixture before UI recording generation", () => control.saveFlow({
      projectId: project.id,
      expectedUpdatedAt: graphFlow.updatedAt,
      authorizationPin: config.pin,
      flow: { ...graphFlow.document, nodes: [], edges: [], dependencies: [], metadata },
    }).then(() => undefined));
  }
  const persistedGraph = await control.getExactFlow(project.id, graphFlowId);
  assertDemoSubflowOwnership(persistedGraph.document, project.id, flow.flowId, subflow.subflowId, graphFlowId);
  if (!isEmptyDemoFlow(persistedGraph.document, project.id, graphFlowId, graphFlowName)) {
    profile.assertRecordingDerivedFlow(persistedGraph.document);
  }  await openFlowInCurrentProject(panelPage, config.flowName, evidence);
  let router = await control.getFlowRouter(project.id, flow.flowId);
  if (router?.fallback?.kind !== "subflow" || router.fallback.subflowId !== subflow.subflowId) {
    await configureDemoRouterFallbackInPanel(panelPage, config.flowName, profile.subflowName, config.pin, evidence);
    router = await control.getFlowRouter(project.id, flow.flowId);
  }
  if (!router || router.fallback?.kind !== "subflow" || router.fallback.subflowId !== subflow.subflowId) {
    throw new RunnerFailure("environment.missing", "The demo Router does not persist a fallback to its primary Subflow");
  }
  // This is deliberately last: an interrupted migration always retains either
  // the old executable root fixture or the new verified Subflow + Router path.
  if (legacyParentFixture || recoverableInterruptedParent) {
    flow = await control.getExactFlow(project.id, flow.flowId);
    if (legacyParentFixture && !isDemoFixtureDocument(flow.document, project.id, flow.flowId, config.flowName)) throw new RunnerFailure("environment.missing", "Demo parent Flow changed during hierarchy migration");
    if (recoverableInterruptedParent && !isEmptyDemoFlow(flow.document, project.id, flow.flowId, config.flowName)) throw new RunnerFailure("environment.missing", "Interrupted demo parent Flow changed before representation repair");
    await evidence.step("panel", "legacy-parent-graph-migration", "Retire the exact fixture-owned direct parent graph through Core's verified migration boundary", () => control.migrateLegacyFlowRepresentation({
      projectId: project.id,
      flowId: flow.flowId,
      subflowId: subflow.subflowId,
      authorizationPin: config.pin,
    }));
    flow = await control.getExactFlow(project.id, flow.flowId);
  }
  assertDemoParentDocument(flow.document, project.id, flow.flowId, config.flowName);
  const state: DemoWorkspaceState = {
    schemaVersion: SCHEMA_VERSION,
    origin: config.origin,
    username: config.username,
    projectId: project.id,
    flowId: flow.flowId,
    subflowId: subflow.subflowId,
    graphFlowId,
    routerId: router.routerId,
    projectName: project.name,
    flowName: flow.name,
    ...(saved?.latestRecordingId ? { latestRecordingId: saved.latestRecordingId } : {}),
    ...(saved?.latestRuntimeRunId ? { latestRuntimeRunId: saved.latestRuntimeRunId } : {}),
    updatedAt: new Date().toISOString(),
  };
  if (profile.persistWorkspaceState) await saveWorkspaceState(config, state);
  return state;
}

export async function generateDemoSubflowFromRecording(
  page: Page,
  control: ExistingFluxIQControlClient,
  config: DemoWorkspaceConfiguration,
  state: DemoWorkspaceState,
  recordingId: string,
  evidence: BrowserEvidenceRecorder,
  profile: DemoFlowProfile = STANDARD_DEMO_FLOW_PROFILE,
): Promise<DemoWorkspaceState> {
  await evidence.step("panel", "recording-generation-refresh", "Refresh the panel to load the persisted recording", () => page.reload({ waitUntil: "domcontentloaded" }).then(() => undefined));
  await page.locator(".automation-studio-sidebar-heading").getByText(state.projectName, { exact: true }).waitFor();
  await openFlowInCurrentProject(page, state.flowName, evidence);
  const search = page.getByRole("searchbox", { name: "Search project hierarchy" });
  await evidence.step("panel", "recording-generation-search", "Find the newly persisted recording", () => search.fill(recordingId));
  await evidence.step("panel", "recording-generation-open", "Open the newly persisted recording", () => hierarchyRow(page, recordingId).click());
  const generateButton = page.getByRole("button", { name: "Generate Subflow", exact: true });
  await generateButton.waitFor();
  await evidence.step("panel", "recording-generation-dialog", "Open deterministic Subflow generation", () => generateButton.click());
  const dialog = page.getByRole("dialog", { name: "Generate deterministic Subflow" });
  await dialog.getByLabel("Destination Flow").selectOption(state.flowId);
  await evidence.step("panel", "recording-generation-pin", "Authorize recording-derived Subflow generation", () => dialog.getByLabel("Security PIN").fill(config.pin), { sensitive: true });
  const response = await evidence.step("panel", "recording-generation-submit", "Generate the deterministic Subflow from the recording", () => (
    waitForPanelMutationResponse(page, "/api/programs/automation-studio/review-recording-flow-proposal", () => dialog.getByRole("button", { name: "Generate Subflow", exact: true }).click())
  ), { sensitive: true });
  const body = await response.json() as any;
  if (!response.ok() || body?.ok === false) throw new RunnerFailure("runtime.behavior", body?.error ?? "Panel recording generation failed");
  await dialog.waitFor({ state: "hidden" });
  const parent = await control.getExactFlow(state.projectId, state.flowId);
  assertDemoParentDocument(parent.document, state.projectId, state.flowId, state.flowName);
  if ((parent.document.metadata as Record<string, unknown> | undefined)?.lastRecordingId !== recordingId) {
    throw new RunnerFailure("runtime.behavior", "Generated parent Flow does not retain the source recording identity");
  }
  const subflow = (await control.listFlowSubflows(state.projectId, state.flowId)).find(item => item.subflowId === state.subflowId);
  if (!subflow?.graphFlowId || subflow.graphFlowId !== state.graphFlowId) throw new RunnerFailure("runtime.behavior", "Recording generation did not retain the expected primary Subflow ownership");
  const graph = await control.getExactFlow(state.projectId, state.graphFlowId);
  assertDemoSubflowOwnership(graph.document, state.projectId, state.flowId, state.subflowId, state.graphFlowId);
  profile.assertRecordingDerivedFlow(graph.document, recordingId);
  const router = await control.getFlowRouter(state.projectId, state.flowId);
  if (!router || router.routerId !== state.routerId || router.fallback?.subflowId !== state.subflowId) throw new RunnerFailure("runtime.behavior", "Recording generation did not retain the parent Router fallback");
  await evidence.step("panel", "recording-generation-result-refresh", "Reload the panel to render the persisted generated graph", () => page.reload({ waitUntil: "domcontentloaded" }).then(() => undefined));
  await page.locator(".automation-studio-sidebar-heading").getByText(state.projectName, { exact: true }).waitFor();
  await openFlowInCurrentProject(page, state.flowName, evidence);
  await openSubflowInCurrentProject(page, profile.subflowName, evidence);
  await assertDemoFlowRenderedLayout(page, evidence, profile.renderedNodeCounts);
  return state;
}

export async function requireDemoFlow(control: ExistingFluxIQControlClient, config: DemoWorkspaceConfiguration): Promise<DemoWorkspaceState> {
  const state = await loadWorkspaceState(config);
  if (!state) throw new RunnerFailure("environment.missing", "Demo workspace is not provisioned; run pnpm demo:record first");
  if (state.schemaVersion !== SCHEMA_VERSION) throw new RunnerFailure("environment.missing", "Demo workspace hierarchy needs migration; run pnpm demo:record first");
  const project = await control.requireProject(state.projectId, "web-automation");
  if (project.domainId !== "web-automation") throw new RunnerFailure("environment.missing", "Saved demo project is not a web-automation project");
  const flow = await control.getExactFlow(state.projectId, state.flowId);
  assertDemoParentDocument(flow.document, state.projectId, state.flowId, state.flowName);
  const subflow = (await control.listFlowSubflows(state.projectId, state.flowId)).find(item => item.subflowId === state.subflowId);
  if (!subflow || subflow.graphFlowId !== state.graphFlowId) throw new RunnerFailure("environment.missing", "Saved demo Subflow identity no longer matches Core");
  const graphFlow = await control.getExactFlow(state.projectId, state.graphFlowId);
  assertDemoSubflowOwnership(graphFlow.document, state.projectId, state.flowId, state.subflowId, state.graphFlowId);
  const graphFlowName = typeof graphFlow.document.name === "string" && graphFlow.document.name.trim() ? graphFlow.document.name : `${DEMO_SUBFLOW_NAME} Graph`;
  if (!state.latestRecordingId) throw new RunnerFailure("environment.missing", "Demo workspace does not identify the recording that generated its Subflow");
  assertDemoRecordingDerivedFlow(graphFlow.document, state.latestRecordingId);
  const router = await control.getFlowRouter(state.projectId, state.flowId);
  if (!router || router.routerId !== state.routerId || router.fallback?.subflowId !== state.subflowId) throw new RunnerFailure("environment.missing", "Saved demo Router no longer targets its primary Subflow");
  await control.selectExistingContext(state.projectId);
  return state;
}
