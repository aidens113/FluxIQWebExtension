// The proposal-only half of the module: explore the connected website and
// leave exactly one reviewable proposal behind. There is no approve or apply
// seam here by design. The terminal classifier is why: a high-token
// confirmation dialog is a stopping point, not an alert, and the run reports
// it rather than clicking through to a build nobody authorized.

import type { Locator, Page, Request, Response } from "@playwright/test";
import type { BrowserEvidenceRecorder } from "../browser-evidence.js";
import { ExistingFluxIQControlClient } from "../existing-fluxiq-control.js";
import type { BuildApproveApplyCreationInput } from "./build-flow-ui.js";
import type { EvidenceGuidedCreationCheckpoint } from "./creation-outcomes.js";
import { sanitizeGenerationFailureBody } from "./generation-failure.js";
import { recordExplorationGenerationFailure } from "./exploration-failure-evidence.js";
import { assertProviderFreeGenerationReadiness } from "./generation-readiness.js";
import { finite, identifier, integer, record, text } from "./json-shapes.js";
import { EVIDENCE_GUIDED_CREATION_COMMAND_TIMEOUT_MS, EVIDENCE_GUIDED_CREATION_LIMITS, LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD } from "./limits.js";
import { exactVirtualizedHierarchyObject, exactVisible } from "./panel-interaction.js";
import { fail } from "./runner-fail.js";

export async function proposeEvidenceGuidedCreationViaUi(input: Omit<BuildApproveApplyCreationInput, "pin" | "flowTreeItemId"> & { flowTreeItemId: string; flowName: string; instruction: string; targetPage: Page }): Promise<EvidenceGuidedCreationCheckpoint> {
  const { page, projectId, flowId, evidence, control, blankContentHash } = input;
  let flowTreeItemId = input.flowTreeItemId;
  await page.context().addCookies([{ name: "fluxiq_session", value: control.sessionCookieValue(), url: new URL(page.url()).origin }]);
  await assertProviderFreeGenerationReadiness(page, evidence);
  if ((await control.listFlowAdaptations(projectId, flowId, "proposed")).length !== 0) fail("Exploration checkpoint Flow already has a proposed adaptation");
  const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
  const search = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
  await evidence.step("panel", "explore-flow-search", "Re-resolve the exact checkpoint Flow before Runtime Debug", () => search.fill(input.flowName));
  const flows = hierarchy.locator(".automation-tree-item").filter({ has: page.locator(".tree-row-main.type-flow .tree-row-label > strong").getByText(input.flowName, { exact: true }) });
  await exactVisible(flows, "the exact checkpoint Flow hierarchy item");
  const current = flows.first();
  await evidence.step("panel", "explore-flow-open", "Restore the exact checkpoint Flow selection", () => current.locator(".tree-row-main.type-flow").click());
  if (await current.getAttribute("aria-expanded") === "false") await evidence.step("panel", "explore-flow-expand", "Expand the exact checkpoint Flow", () => current.getByRole("button", { name: `Expand ${input.flowName}` }).click());
  flowTreeItemId = await current.getAttribute("data-tree-item-id") ?? fail("The exact checkpoint Flow hierarchy identity is unavailable");
  await evidence.step("panel", "explore-runtime-search", "Search the checkpoint Flow for Runtime Debug", () => search.fill("Runtime Debug"));
  const rows = await exactVirtualizedHierarchyObject(page, hierarchy, `${flowTreeItemId}-runtime-debug`, "the exact exploration Runtime Debug row");
  await evidence.step("panel", "explore-runtime-open", "Open Runtime Debug for the exploration checkpoint Flow", () => rows.click());
  await evidence.step("panel", "explore-runtime-search-clear", "Clear hierarchy search", () => search.fill(""));
  const authoring = page.getByRole("region", { name: "Build Flow from instructions", exact: true });
  await exactVisible(authoring, "the evidence-guided Flow authoring region", 30_000);
  const task = authoring.getByLabel("Website task", { exact: true });
  await evidence.step("panel", "explore-task", "Enter the bounded website task", () => task.fill(input.instruction));
  const explore = authoring.getByRole("button", { name: "Explore and create proposal", exact: true });
  await exactVisible(explore, "the Explore and create proposal action");
  await evidence.step("scenario", "explore-target-reactivate", "Reactivate the intended website immediately before evidence-guided generation", () => input.targetPage.bringToFront());
  let terminal = await evidence.step("panel", "explore-propose", "Explore the connected website and create one reviewable proposal", () => waitForExplorationTerminal(page, authoring, control, projectId, flowId, () => explore.click()));
  if (terminal.kind === "high_token_confirmation") {
    // Core's own rule: the run's token budget, or one call's limit if larger. Not calls times tokens.
    const aggregateAuthorizedTokens = Math.max(EVIDENCE_GUIDED_CREATION_LIMITS.maxTotalTokensPerRun, EVIDENCE_GUIDED_CREATION_LIMITS.maxTotalTokens);
    await evidence.diagnostic("panel", "exploration-high-token-confirmation", "exploration.high-token-confirmation-required", {
      apiRequestObserved: terminal.requestObserved,
      aggregateAuthorizedTokens,
      confirmationThreshold: LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD,
      configuredProfileRequiresConfirmation: aggregateAuthorizedTokens >= LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD,
      confirmationAttempted: true,
    });
    const dialog = page.getByRole("dialog", { name: "Confirm high-token Flow Build", exact: true });
    await exactVisible(dialog, "the high-token Flow Build confirmation");
    terminal = await evidence.step("panel", "explore-high-token-confirm", "Confirm the explicitly authorized high-token exploration", () => waitForExplorationTerminal(
      page,
      authoring,
      control,
      projectId,
      flowId,
      () => dialog.getByRole("button", { name: "Continue high-token build", exact: true }).click(),
      { ignoreHighTokenConfirmation: true },
    ));
  }
  if (terminal.kind === "ui_failure") {
    await evidence.diagnostic("panel", "exploration-ui-terminal", "exploration.ui-terminal-failure", { apiRequestObserved: terminal.requestObserved, apiResponseObserved: false, uiTerminalFailure: true });
    fail("Evidence-guided Flow generation reached a terminal UI failure");
  }
  if (terminal.kind === "high_token_confirmation") {
    fail("Evidence-guided Flow generation repeated its high-token confirmation after explicit approval");
  }
  if (terminal.kind === "timeout") {
    await evidence.diagnostic("panel", "exploration-terminal-timeout", "exploration.terminal-timeout", { apiResponseObserved: false, uiTerminalFailure: false });
    fail("Evidence-guided Flow generation did not reach a bounded terminal state");
  }
  let generationBody: unknown;
  let permissionConfirmed = false;
  while (terminal.kind === "response") {
    await evidence.diagnostic("panel", "exploration-generation-response", "exploration.generation-response", {
      httpStatus: terminal.response.status(),
      responseOk: terminal.response.ok(),
    });
    await page.waitForTimeout(150);
    const visibleErrorCode = await visibleGenerationErrorCode(authoring);
    await evidence.diagnostic("panel", "exploration-visible-error", visibleErrorCode ?? "exploration.visible-error.absent", {
      visibleGenericError: visibleErrorCode !== undefined,
    });
    const dialog = page.getByRole("dialog", { name: "Confirm Flow action consequences", exact: true });
    const generationText = await settleObservedResponseText(terminal.response, 2_000);
    if (generationText !== undefined) {
      try { generationBody = JSON.parse(generationText) as unknown; } catch { /* sanitized failure parsing below */ }
    }
    if (terminal.response.ok() && generationBody && typeof generationBody === "object" && !Array.isArray(generationBody) && (generationBody as Record<string, unknown>).ok === true) break;
    const permissionDialogVisible = await dialog.isVisible().catch(() => false);
    if (generationText === undefined) {
      await evidence.diagnostic("panel", "exploration-response-body", "exploration.response-body-unsettled", { permissionDialogVisible });
      if (!permissionDialogVisible || permissionConfirmed) fail("Evidence-guided Flow generation response body did not settle");
    } else {
      const failure = sanitizeGenerationFailureBody(terminal.response.status(), generationText);
      await recordExplorationGenerationFailure(evidence, failure);
      if (failure.reasonCode !== "flow_bootstrap.permission_required" || permissionConfirmed) fail(`Evidence-guided Flow generation failed (${failure.code})`);
    }

    await exactVisible(dialog, "the Flow action consequence confirmation");
    const consequences = dialog.getByRole("list", { name: "Consequences requiring approval", exact: true }).getByRole("listitem");
    const consequenceCount = await consequences.count();
    if (consequenceCount < 1 || consequenceCount > 8) fail("Flow action consequence confirmation was not bounded");
    await evidence.diagnostic("panel", "exploration-permission-request", "exploration.permission-required", { consequenceCount, proposalCountBeforeApproval: 0 });
    if ((await control.listFlowAdaptations(projectId, flowId, "proposed")).length !== 0) fail("Permission request created a proposal before approval");
    if ((await control.getExactFlow(projectId, flowId)).contentHash !== blankContentHash) fail("Permission request mutated the blank Flow before approval");
    await evidence.step("panel", "explore-permission-cancel", "Cancel the bounded consequence request", () => dialog.getByRole("button", { name: "Cancel", exact: true }).click());
    await dialog.waitFor({ state: "hidden" });
    if ((await control.listFlowAdaptations(projectId, flowId, "proposed")).length !== 0) fail("Cancelling permission created a proposal");
    if ((await control.getExactFlow(projectId, flowId)).contentHash !== blankContentHash) fail("Cancelling permission mutated the blank Flow");
    await evidence.step("panel", "explore-permission-reopen", "Reopen the retained consequence request", () => authoring.getByRole("button", { name: "Review requested permissions", exact: true }).click());
    await exactVisible(dialog, "the retained Flow action consequence confirmation");
    permissionConfirmed = true;
    terminal = await evidence.step("panel", "explore-permission-confirm", "Approve only the named Flow action consequences", () => waitForExplorationTerminal(
      page, authoring, control, projectId, flowId,
      () => dialog.getByRole("button", { name: "Allow and continue", exact: true }).click(),
      { ignoreHighTokenConfirmation: true },
    ));
  }
  const proposed = await control.listFlowAdaptations(projectId, flowId, "proposed");
  if (proposed.length !== 1 || terminal.kind === "proposal" && proposed[0]?.adaptationId !== terminal.adaptationId) {
    await evidence.diagnostic("panel", "exploration-proposal-result", "exploration.proposal-count-mismatch", {
      proposedCount: proposed.length,
      terminalReportedProposal: terminal.kind === "proposal",
      terminalProposalMatched: terminal.kind === "proposal" && proposed[0]?.adaptationId === terminal.adaptationId,
    });
    fail("Exploration did not persist exactly one scoped proposal");
  }
  const detail = await control.getFlowAdaptation(projectId, flowId, proposed[0]!.adaptationId);
  if (detail.status !== "proposed" || detail.adaptationKind !== "flow_bootstrap" || !detail.evidenceLoop) fail("Exploration proposal omitted its bounded evidence-loop audit");
  const parsed = terminal.kind === "response"
    ? parseEvidenceGuidedCreationProposal(generationBody, projectId, flowId)
    : parseEvidenceGuidedCreationProposal({ ok: true, payload: { adaptation: { projectId, flowId, adaptationId: detail.adaptationId, status: detail.status, accounting: detail.accounting } } }, projectId, flowId);
  if (parsed.adaptationId !== detail.adaptationId) fail("Exploration API response did not match the exact persisted proposal");
  if (detail.evidenceLoop.toolCallCount < 1 || detail.evidenceLoop.evidenceBytes < 1 || detail.evidenceLoop.toolIds.length < 1) fail("Exploration proposal did not attest website evidence collection");
  const providerCallCount = detail.evidenceLoop.providerCallCount;
  if (providerCallCount === undefined) fail("New exploration proposal omitted explicit provider-call accounting");
  if ((await control.getExactFlow(projectId, flowId)).contentHash !== blankContentHash) fail("Exploration mutated the blank Flow before review");
  const result: EvidenceGuidedCreationCheckpoint = Object.freeze({
    ...parsed,
    providerCallCount,
    toolCallCount: detail.evidenceLoop.toolCallCount,
    evidenceBytes: detail.evidenceLoop.evidenceBytes,
    toolIds: detail.evidenceLoop.toolIds,
  });
  await evidence.diagnostic("panel", "exploration-proposal", "exploration-proposal.v1", { statusProposed: true, providerCallCount: result.providerCallCount, toolCallCount: result.toolCallCount, evidenceBytes: result.evidenceBytes, toolIdCount: result.toolIds.length, inputTokens: result.inputTokens, outputTokens: result.outputTokens, totalTokens: result.totalTokens });
  return result;
}

export function parseEvidenceGuidedCreationProposal(body: unknown, projectId: string, flowId: string): Omit<EvidenceGuidedCreationCheckpoint, "providerCallCount" | "toolCallCount" | "evidenceBytes" | "toolIds"> {
  const root = record(body); if (root.ok !== true) fail("Evidence-guided Flow bootstrap generation failed");
  const value = record(record(root.payload).adaptation), accounting = record(value.accounting);
  if (text(value.projectId) !== projectId || text(value.flowId) !== flowId || value.status !== "proposed") fail("Evidence-guided proposal escaped its checkpoint scope");
  const inputTokens = integer(accounting.inputTokens), outputTokens = integer(accounting.outputTokens), totalTokens = integer(accounting.totalTokens), estimatedCostUsd = finite(accounting.estimatedCostUsd);
  if (inputTokens + outputTokens !== totalTokens || totalTokens > EVIDENCE_GUIDED_CREATION_LIMITS.maxTotalTokensPerRun || estimatedCostUsd > EVIDENCE_GUIDED_CREATION_LIMITS.maxTotalEstimatedCostUsd) fail("Evidence-guided accounting exceeded its aggregate bounds");
  if (text(accounting.provider) !== "deepseek" || text(accounting.model) !== "deepseek-chat") fail("Evidence-guided proposal used an unexpected provider or model");
  return Object.freeze({ adaptationId: identifier(value.adaptationId), status: "proposed" as const, provider: "deepseek" as const, model: "deepseek-chat" as const, inputTokens, outputTokens, totalTokens, estimatedCostUsd });
}

type ExplorationTerminal = { kind: "response"; response: Response } | { kind: "proposal"; adaptationId: string } | ExplorationUiTerminal | { kind: "timeout" };
export type ExplorationUiTerminal = { kind: "high_token_confirmation" | "ui_failure"; requestObserved: boolean };
export function classifyExplorationUiTerminal(input: { highTokenConfirmationVisible: boolean; alertVisible: boolean; requestObserved: boolean }): ExplorationUiTerminal | undefined {
  if (input.highTokenConfirmationVisible) return { kind: "high_token_confirmation", requestObserved: input.requestObserved };
  if (input.alertVisible) return { kind: "ui_failure", requestObserved: input.requestObserved };
  return undefined;
}
async function waitForExplorationTerminal(
  page: Page,
  authoring: Locator,
  control: Pick<ExistingFluxIQControlClient, "listFlowAdaptations">,
  projectId: string,
  flowId: string,
  dispatch: () => Promise<void>,
  options: { ignoreHighTokenConfirmation?: boolean } = {},
): Promise<ExplorationTerminal> {
  const context = page.context();
  let request: Request | undefined;
  let captured: Response | undefined;
  const matches = (candidate: Request) => candidate.method() === "POST" && candidate.url().includes("/api/programs/automation-studio/generate-flow-bootstrap-adaptation");
  const observeRequest = (candidate: Request) => { if (matches(candidate)) request = candidate; };
  const observe = (response: Response) => {
    if (matches(response.request())) captured = response;
  };
  const observeFinished = (candidate: Request) => {
    if (!matches(candidate)) return;
    request = candidate;
    void candidate.response().then(response => { if (response) captured = response; }).catch(() => undefined);
  };
  context.on("request", observeRequest);
  context.on("response", observe);
  context.on("requestfinished", observeFinished);
  try {
    await dispatch();
    const deadline = Date.now() + EVIDENCE_GUIDED_CREATION_COMMAND_TIMEOUT_MS;
    let nextProposalProbe = 0;
    while (Date.now() < deadline) {
      if (captured) return { kind: "response", response: captured };
      const uiTerminal = classifyExplorationUiTerminal({
        highTokenConfirmationVisible: options.ignoreHighTokenConfirmation !== true
          && await page.getByRole("dialog", { name: "Confirm high-token Flow Build", exact: true }).isVisible().catch(() => false),
        alertVisible: await authoring.getByRole("alert").isVisible().catch(() => false),
        requestObserved: request !== undefined,
      });
      if (uiTerminal) {
        const response = await settleObservedResponse(page, request, captured, 2_000);
        return response ? { kind: "response", response } : uiTerminal;
      }
      if (Date.now() >= nextProposalProbe) {
        nextProposalProbe = Date.now() + 1_000;
        const proposed = await control.listFlowAdaptations(projectId, flowId, "proposed");
        if (proposed.length > 1) fail("Exploration persisted more than one scoped proposal");
        if (proposed.length === 1) return { kind: "proposal", adaptationId: proposed[0]!.adaptationId };
      }
      await page.waitForTimeout(100);
    }
    return { kind: "timeout" };
  } finally {
    context.off("request", observeRequest);
    context.off("response", observe);
    context.off("requestfinished", observeFinished);
  }
}

async function settleObservedResponse(page: Page, request: Request | undefined, captured: Response | undefined, timeout: number): Promise<Response | undefined> {
  if (captured) return captured;
  if (!request) return undefined;
  return Promise.race([
    request.response().then(response => response ?? undefined).catch(() => undefined),
    page.waitForTimeout(timeout).then(() => undefined),
  ]);
}

export async function settleObservedResponseText(response: Pick<Response, "text">, timeout: number): Promise<string | undefined> {
  let cancelDeadline: () => void = () => {};
  const deadline = new Promise<undefined>((resolve) => {
    const timer = globalThis.setTimeout(resolve, timeout);
    cancelDeadline = () => globalThis.clearTimeout(timer);
  });
  try {
    return await Promise.race([
      response.text(),
      deadline,
    ]);
  } finally {
    cancelDeadline();
  }
}

const VISIBLE_GENERATION_ERRORS = Object.freeze([
  ["exploration.visible-error.provider-timeout", "The model request timed out. Keep the browser connected and try again."],
  ["exploration.visible-error.evidence-limit", "Exploration reached its evidence limit before it could create a proposal. Start closer to the target page or make the website task more specific, then try again."],
  ["exploration.visible-error.tool-failed", "The connected browser could not complete an exploration action. Check that the target tab is still available, then try again."],
  ["exploration.visible-error.interrupted", "Exploration was interrupted. Keep the browser connected and try again."],
  ["exploration.visible-error.proposal-missing", "Website exploration did not create a Flow proposal. Check the connected browser and task, then try again."],
  ["exploration.visible-error.authorization-failed", "Flow authoring authorization failed. Verify your session and enabled key."],
  ["exploration.visible-error.command-failed", "Flow authoring could not be completed."],
] as const);

async function visibleGenerationErrorCode(authoring: Locator): Promise<string | undefined> {
  const alert = authoring.getByRole("alert");
  for (const [code, message] of VISIBLE_GENERATION_ERRORS) {
    if (await alert.getByText(message, { exact: true }).isVisible().catch(() => false)) return code;
  }
  return undefined;
}
