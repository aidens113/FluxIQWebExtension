// Reviewing, applying and running a runtime adaptation through the panel, and
// the run-detail checks that say the adaptation behaved.
import type { Page } from "@playwright/test";
import { BrowserEvidenceRecorder } from "../browser-evidence.js";
import { type ExistingFlowAdaptation, ExistingFluxIQControlClient, type ExistingRunDetail, type ExistingRunEvent, type ExistingRunIntervention } from "../existing-fluxiq-control.js";
import { RunnerFailure } from "../failure.js";
import { exactVirtualizedHierarchyObject } from "../demo-llm-create-ui.js";
import { explorationAdaptationRunIsComplete } from "../demo-llm-exploration-adaptation-wait.js";
import { isTerminalRuntimeStatus, waitForRoutedRunDetail } from "./control-waits.js";
import { selectFlowInCurrentProject } from "./panel-navigation.js";
import { runDemoFlowFromPanel, waitForPanelMutationResponse, waitForPanelRunResponse } from "./panel-run.js";
import type { DemoWorkspaceState } from "./workspace-state.js";

export async function reviewAndApplyAdaptationViaUi(
  page: Page,
  control: ExistingFluxIQControlClient,
  state: DemoWorkspaceState,
  adaptationId: string,
  pin: string,
  evidence: BrowserEvidenceRecorder,
  alreadyOpen = false,
  initialStatus = "proposed",
): Promise<ExistingFlowAdaptation> {
  if (!alreadyOpen) {
    await evidence.step("panel", "adaptation-review-open", "Open the exact generated adaptation for manual review", () => (
      page.getByRole("button", { name: `Review ${adaptationId}`, exact: true }).click()
    ));
  }
  const detailViews = page.getByRole("navigation", { name: "Adaptation detail views", exact: true });
  await detailViews.waitFor({ state: "visible", timeout: 30_000 });
  await evidence.step("panel", "adaptation-review-audit", "Open the adaptation audit and review actions", () => (
    detailViews.getByRole("button", { name: "Audit", exact: true }).click()
  ));

  if (initialStatus === "proposed") {
    await evidence.step("panel", "adaptation-review-approve", "Approve the generated adaptation for application", () => (
      page.getByRole("button", { name: "Approve", exact: true }).click()
    ));
    const approveDialog = page.getByRole("dialog", { name: "Approve Adaptation", exact: true });
    await evidence.step("panel", "adaptation-review-approve-pin", "Authorize adaptation approval with the current PIN", () => (
      approveDialog.getByLabel(/^PIN/u).fill(pin)
    ), { sensitive: true });
    const approveResponse = await evidence.step("panel", "adaptation-review-approve-submit", "Confirm manual adaptation approval", () => (
      waitForPanelMutationResponse(page, "/api/programs/automation-studio/review-flow-adaptation", () => approveDialog.getByRole("button", { name: "Approve", exact: true }).click())
    ), { sensitive: true });
    if (!approveResponse.ok()) throw new RunnerFailure("runtime.behavior", "The manual UI adaptation approval was rejected");
    await approveDialog.waitFor({ state: "hidden", timeout: 30_000 });
    const approved = await control.getFlowAdaptation(state.projectId, state.flowId, adaptationId);
    if (approved.status !== "validated") throw new RunnerFailure("runtime.behavior", "The manual UI approval did not validate the exact adaptation");
  }

  await evidence.step("panel", "adaptation-review-apply", "Request durable application of the approved adaptation", () => (
    page.getByRole("button", { name: "Apply Changes", exact: true }).click()
  ));
  const applyDialog = page.getByRole("dialog", { name: "Apply Adaptation", exact: true });
  await evidence.step("panel", "adaptation-review-apply-pin", "Authorize adaptation application with the current PIN", () => (
    applyDialog.getByLabel(/^PIN/u).fill(pin)
  ), { sensitive: true });
  const applyResponse = await evidence.step("panel", "adaptation-review-apply-submit", "Apply the reviewed adaptation", () => (
    waitForPanelMutationResponse(page, "/api/programs/automation-studio/review-flow-adaptation", () => applyDialog.getByRole("button", { name: "Apply Changes", exact: true }).click())
  ), { sensitive: true });
  if (!applyResponse.ok()) throw new RunnerFailure("runtime.behavior", "The manual UI adaptation apply was rejected");
  await applyDialog.waitFor({ state: "hidden", timeout: 30_000 });
  const applied = await control.getFlowAdaptation(state.projectId, state.flowId, adaptationId);
  if (applied.status !== "applied") throw new RunnerFailure("runtime.behavior", "The manual UI apply did not persist the exact adaptation");
  return applied;
}

export async function openAdaptationFromPanel(page: Page, flowTreeItemId: string, adaptationId: string, evidence: BrowserEvidenceRecorder): Promise<void> {
  const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
  const search = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
  await evidence.step("panel", "adaptation-resume-search", "Search the exact Flow hierarchy for Adaptations", () => search.fill("Adaptations"));
  const rows = await exactVirtualizedHierarchyObject(
    page,
    hierarchy,
    `${flowTreeItemId}-adaptations`,
    "the exact Flow Adaptations row",
    ".tree-row-main.type-folder",
  );
  await evidence.step("panel", "adaptation-resume-open", "Open the exact Flow Adaptations workspace", () => rows.click());
  await evidence.step("panel", "adaptation-resume-search-clear", "Clear hierarchy search after Adaptations opens", () => search.fill(""));
  const table = page.getByRole("table", { name: "Adaptations", exact: true });
  await table.waitFor({ state: "visible", timeout: 30_000 });
  await page.getByText("Loading adaptations...", { exact: true }).waitFor({ state: "hidden", timeout: 30_000 });
  const row = table.getByRole("row").filter({ hasText: adaptationId });
  if (await row.count() !== 1) throw new RunnerFailure("runtime.behavior", "The exact pending adaptation is unavailable in the UI inbox");
  await evidence.step("panel", "adaptation-resume-select", "Select the exact pending target proposal", () => row.click());
  await page.getByRole("navigation", { name: "Adaptation detail views", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
}

export async function runAdaptationFromPanel(page: Page, flowTreeItemId: string, evidence: BrowserEvidenceRecorder): Promise<{ runId: string; status: string }> {
  const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
  const search = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
  await evidence.step("panel", "adaptation-runtime-search", "Search the exact Flow hierarchy for Runtime Debug", () => search.fill("Runtime Debug"));
  const runtimeRows = await exactVirtualizedHierarchyObject(page, hierarchy, `${flowTreeItemId}-runtime-debug`, "the exact Flow Runtime Debug row for adaptation");
  await evidence.step("panel", "adaptation-runtime-open", "Open Runtime Debug for the generated Flow", () => runtimeRows.click());
  const runCommand = page.locator(".automation-runtime-run-command");
  await runCommand.waitFor({ timeout: 30_000 });
  await evidence.step("panel", "adaptation-runtime-search-clear", "Clear hierarchy search after Runtime Debug opens", () => search.fill(""));
  await page.getByText("Checking Flow readiness...", { exact: true }).waitFor({ state: "hidden", timeout: 30_000 });
  await evidence.step("panel", "adaptation-runtime-mode", "Select Diagnose and propose adaptation", () => runCommand.getByRole("button", { name: "Diagnose and propose adaptation", exact: true }).click());
  const runButton = runCommand.getByRole("button", { name: "Run", exact: true });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline && await runButton.isDisabled()) await page.waitForTimeout(100);
  if (await runButton.isDisabled()) throw new RunnerFailure("runtime.behavior", "Diagnose and propose adaptation mode was not ready to run");
  const response = await evidence.step("panel", "adaptation-runtime-run", "Run one bounded diagnosis and adaptation proposal", () => waitForPanelRunResponse(page, () => runButton.click()));
  const body = await response.json() as any;
  if (!response.ok()) throw new RunnerFailure("runtime.behavior", "The authenticated adaptation run request was rejected", { details: { reasonCode: adaptationRunRejectionCode(body?.error) } });
  const runId = body?.payload?.runtimeSession?.runId;
  if (typeof runId !== "string") throw new RunnerFailure("runtime.behavior", "The authenticated adaptation run failed to return a bounded run identity");
  return { runId, status: String(body?.payload?.runtimeSession?.status ?? "unknown") };
}

export function adaptationRunRejectionCode(value: unknown): string {
  const message = typeof value === "string" ? value.toLowerCase() : "";
  if (/settings revision/u.test(message)) return "adaptation_run.settings_revision_mismatch";
  if (/execution digest/u.test(message)) return "adaptation_run.execution_digest_mismatch";
  if (/execution grant|grant/u.test(message)) return "adaptation_run.grant_invalid";
  if (/provider resolution/u.test(message)) return "adaptation_run.provider_resolution_failed";
  if (/secret|api key|key unavailable/u.test(message)) return "adaptation_run.secret_unavailable";
  if (/budget|token|cost|call limit/u.test(message)) return "adaptation_run.budget_rejected";
  return "adaptation_run.request_rejected";
}

export async function waitForAdaptationRun(control: ExistingFluxIQControlClient, projectId: string, runId: string): Promise<ExistingRunDetail> {
  const deadline = Date.now() + 60_000;
  let detail = await control.getRunDetail(projectId, runId);
  // A terminal diagnosis+patch run may intentionally create no adaptation
  // when deterministic evidence validation rejects the model's target. Do not
  // spend the remainder of the timeout waiting for an ID that cannot appear.
  while (Date.now() < deadline && !explorationAdaptationRunIsComplete(detail)) {
    await new Promise(resolve => setTimeout(resolve, 100));
    detail = await control.getRunDetail(projectId, runId);
  }
  if (!isTerminalRuntimeStatus(detail.summary.status)) throw new RunnerFailure("runtime.behavior", "Adaptation run did not reach a terminal state");
  return detail;
}

export function requireCompleteAdaptationIntervention(item: ExistingRunIntervention): void {
  const expectedPromptVersion = item.kind === "diagnosis"
    ? "automation-studio.runtime-diagnosis.v1"
    : item.kind === "runtime_patch"
      ? "automation-studio.runtime-patch.v1"
      : undefined;
  if (!item.requestId || !item.promptVersion || item.provider !== "deepseek" || item.model !== "deepseek-chat" || item.validationOk !== true
    || item.promptVersion !== expectedPromptVersion
    || !Number.isSafeInteger(item.inputTokens) || !Number.isSafeInteger(item.outputTokens) || !Number.isSafeInteger(item.totalTokens)
    || typeof item.estimatedCostUsd !== "number" || !Number.isFinite(item.estimatedCostUsd)) {
    throw new RunnerFailure("runtime.behavior", "Adaptation intervention omitted sanitized provider provenance or accounting");
  }
}

export function requireRunEventSequence(events: ExistingRunEvent[], kind: ExistingRunEvent["eventKind"], entityId: string): number {
  const matching = events.filter(item => item.eventKind === kind && item.entityId === entityId);
  if (matching.length !== 1) throw new RunnerFailure("runtime.behavior", "Adaptation run did not expose one exact durable event for a required phase");
  return matching[0]!.sequence;
}

export function adaptationInvocation(item: ExistingRunIntervention, purpose: "runtime_diagnosis" | "runtime_patch", sequence: number) {
  return {
    requestId: item.requestId!, purpose, provider: "deepseek" as const, model: "deepseek-chat" as const,
    promptSchemaVersion: item.promptVersion!, sequence, attempt: 1 as const, retryCount: 0 as const, providerCallCount: 1 as const,
    inputTokens: item.inputTokens!, outputTokens: item.outputTokens!, totalTokens: item.totalTokens!, estimatedCostUsd: item.estimatedCostUsd!, latencyMs: 0,
  };
}

export async function runZeroLlmAdaptationValidation(input: { control: ExistingFluxIQControlClient; panelPage: Page; scenarioPage: Page; scenarioUrl: string; state: DemoWorkspaceState; evidence: BrowserEvidenceRecorder; step: string }): Promise<ExistingRunDetail> {
  await input.evidence.step("scenario", `adaptation-${input.step}-reload`, "Reload the drifted semantic target fixture", () => input.scenarioPage.goto(input.scenarioUrl).then(() => undefined));
  await input.scenarioPage.getByTestId("instruction-target-drift-status").filter({ hasText: "Target mode: drifted" }).waitFor({ timeout: 10_000 });
  await selectFlowInCurrentProject(input.panelPage, input.state.flowName, input.evidence);
  const started = await runDemoFlowFromPanel(input.panelPage, input.state, input.evidence);
  const detail = await waitForRoutedRunDetail(input.control, input.state, started.runId, input.state.flowId ? 1 : 1);
  if (detail.summary.status !== "succeeded" || detail.actionAttempts.length < 1 || detail.actionAttempts.some(item => item.status !== "succeeded")
    || (detail.providerCallCount ?? 0) !== 0 || (detail.interventions?.length ?? 0) !== 0 || (detail.adaptationIds?.length ?? 0) !== 0
    || (detail.changeProposalIds?.length ?? 0) !== 0 || (detail.summary.adaptationCount ?? 0) !== 0) {
    throw new RunnerFailure("runtime.behavior", "Post-apply deterministic validation used LLM assistance, created adaptations, or failed actions");
  }
  await input.scenarioPage.getByTestId("result").filter({ hasText: "Submitted: Ada / team" }).waitFor({ timeout: 30_000 });
  return detail;
}

export async function assertAdaptationFlowsRemainRecordingFree(control: ExistingFluxIQControlClient, state: DemoWorkspaceState): Promise<void> {
  for (const flowId of [state.flowId, state.graphFlowId]) {
    const flow = await control.getExactFlow(state.projectId, flowId);
    const serialized = JSON.stringify(flow.document.metadata ?? {});
    if (/"(?:lastRecordingId|recordingId|recordingProvenance)"\s*:/u.test(serialized)) throw new RunnerFailure("recording.persistence", "Runtime adaptation introduced recording provenance into a generated Flow");
  }
}
