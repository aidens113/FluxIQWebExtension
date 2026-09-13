// The one paid Flow bootstrap call, driven end to end through the panel: sync
// the authenticated session, pass the provider-free readiness gate, open
// Runtime Debug, build once, then approve and apply the proposal with the real
// review dialogs. The Flow is re-read before approval, so a build that mutated
// anything ahead of explicit human approval fails here.

import { createHash } from "node:crypto";
import type { Page } from "@playwright/test";
import type { BrowserEvidenceRecorder } from "../browser-evidence.js";
import { ExistingFluxIQControlClient } from "../existing-fluxiq-control.js";
import { inspectAppliedCreation, parseAppliedExecutionDigest } from "./adaptation-lifecycle.js";
import type { LiveCreationGeneration, LiveCreationTopology } from "./creation-outcomes.js";
import { readSanitizedGenerationFailure } from "./generation-failure.js";
import { assertProviderFreeGenerationReadiness } from "./generation-readiness.js";
import { finite, identifier, integer, record, text } from "./json-shapes.js";
import { FIRST_LIVE_CREATION_LIMITS } from "./limits.js";
import { exactVirtualizedHierarchyObject, exactVisible, review, waitForEndpoint } from "./panel-interaction.js";
import { fail } from "./runner-fail.js";

export type BuildApproveApplyCreationInput = {
  page: Page; flowTreeItemId: string; projectId: string; flowId: string; pin: string;
  evidence: BrowserEvidenceRecorder; control: ExistingFluxIQControlClient; blankContentHash: string;
};
type BuildApproveApplyCreationResult = { generation: LiveCreationGeneration; topology: LiveCreationTopology };

export async function buildApproveApplyCreationViaUi(input: BuildApproveApplyCreationInput): Promise<BuildApproveApplyCreationResult> {
  await input.evidence.step("panel", "generation-session-sync", "Synchronize the panel with the current authenticated control session", async () => {
    const origin = new URL(input.page.url()).origin;
    await input.page.context().addCookies([{
      name: "fluxiq_session",
      value: input.control.sessionCookieValue(),
      url: origin,
    }]);
  }, { sensitive: true });
  await assertProviderFreeGenerationReadiness(input.page, input.evidence);
  await input.evidence.diagnostic("panel", "generation-readiness", "generation-readiness.v1", { compatible: true });
  return buildApproveApplyCreationAfterReadiness(input);
}

async function buildApproveApplyCreationAfterReadiness(input: BuildApproveApplyCreationInput): Promise<BuildApproveApplyCreationResult> {
  const { page, flowTreeItemId, projectId, flowId, pin, evidence, control, blankContentHash } = input;
  const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
  const search = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
  await evidence.step("panel", "create-runtime-search", "Search this Flow for Runtime Debug", () => search.fill("Runtime Debug"));
  const rows = await exactVirtualizedHierarchyObject(page, hierarchy, `${flowTreeItemId}-runtime-debug`, "the exact Flow Runtime Debug row");
  await evidence.step("panel", "create-runtime-open", "Open Runtime Debug for this Flow", () => rows.click());
  await evidence.step("panel", "create-runtime-search-clear", "Clear hierarchy search", () => search.fill(""));
  const authoring = page.getByRole("region", { name: "Build Flow from instructions", exact: true });
  await exactVisible(authoring, "the provider-ready Build Flow from instructions region", 30_000);
  const build = authoring.getByRole("button", { name: "Build Flow from instructions", exact: true });
  await exactVisible(build, "the unambiguous Build Flow from instructions action");
  const started = Date.now();
  const response = await evidence.step("panel", "create-build", "Build with the authenticated session using exactly one bounded Flow bootstrap call", () => waitForEndpoint(page, "generate-flow-bootstrap-adaptation", () => build.click()));
  const latencyMs = Date.now() - started;
  if (!response.ok()) {
    const failure = await readSanitizedGenerationFailure(response);
    await evidence.diagnostic("panel", failure.code, failure.reasonCode ?? failure.code, {
      httpStatus: failure.status,
      responseBytes: failure.responseBytes,
      responseParsed: failure.parsed,
      providerCallKnown: failure.providerCallKnown,
      providerCallCount: failure.providerCallCount,
      accountingKnown: failure.accountingKnown,
      accountingAvailable: failure.accountingAvailable,
      ...(failure.estimatedInputTokens === undefined ? {} : { estimatedInputTokens: failure.estimatedInputTokens }),
      ...(failure.inputTokens === undefined ? {} : { inputTokens: failure.inputTokens }),
      ...(failure.outputTokens === undefined ? {} : { outputTokens: failure.outputTokens }),
      ...(failure.totalTokens === undefined ? {} : { totalTokens: failure.totalTokens }),
    });
    fail(`Bounded Flow bootstrap generation failed (${failure.code})`);
  }
  const adaptation = parseGeneration(await response.json(), true, projectId, flowId, latencyMs);
  await exactVisible(page.getByRole("table", { name: "Adaptations", exact: true }), "the generated Flow's Adaptations table", 30_000);
  const proposal = page.getByText(adaptation.adaptationId, { exact: true });
  await exactVisible(proposal, "the exact generated Flow bootstrap proposal", 30_000);
  await evidence.step("panel", "create-adaptation-select", "Select the exact generated Flow bootstrap proposal", () => proposal.click());
  await page.getByText("Adaptation Detail", { exact: true }).waitFor({ timeout: 30_000 });
  const beforeApproval = await control.getExactFlow(projectId, flowId);
  if (beforeApproval.contentHash !== blankContentHash) fail("Flow mutated before explicit human approval");
  const audit = page.getByRole("button", { name: "Audit", exact: true });
  await exactVisible(audit, "the Adaptation Audit tab");
  await evidence.step("panel", "create-adaptation-audit", "Open Adaptation audit and review actions", () => audit.click());
  await review(page, evidence, pin, "Approve Adaptation", "Approve", "create-adaptation-approve");
  const applyResponse = await review(page, evidence, pin, "Apply Adaptation", "Apply Changes", "create-adaptation-apply");
  const appliedExecutionDigest = parseAppliedExecutionDigest(await applyResponse.json(), applyResponse.ok(), adaptation.baseExecutionDigest);
  const topology = await inspectAppliedCreation(control, projectId, flowId, adaptation.baseExecutionDigest, appliedExecutionDigest);
  return { generation: adaptation, topology };
}

function parseGeneration(body: unknown, ok: boolean, projectId: string, flowId: string, latencyMs: number): LiveCreationGeneration {
  const root = record(body); if (!ok || root.ok !== true) fail("Bounded Flow bootstrap generation failed");
  const payload = record(root.payload), value = record(payload.adaptation), accounting = record(value.accounting);
  if (text(value.projectId) !== projectId || text(value.flowId) !== flowId || value.status !== "proposed") fail("Flow bootstrap response escaped its certified scope");
  const inputTokens = integer(accounting.inputTokens), outputTokens = integer(accounting.outputTokens), totalTokens = integer(accounting.totalTokens);
  const cost = finite(accounting.estimatedCostUsd);
  if (inputTokens > FIRST_LIVE_CREATION_LIMITS.maxInputTokens
    || outputTokens > FIRST_LIVE_CREATION_LIMITS.maxOutputTokens
    || totalTokens > FIRST_LIVE_CREATION_LIMITS.maxTotalTokens
    || inputTokens + outputTokens !== totalTokens
    || cost > FIRST_LIVE_CREATION_LIMITS.maxEstimatedCostUsd) fail("Flow bootstrap provider accounting exceeded strict limits");
  if (text(accounting.provider) !== "deepseek" || text(accounting.model) !== "deepseek-chat") fail("Flow bootstrap used an unexpected provider or model");
  const safe = { adaptationId: identifier(value.adaptationId), baseExecutionDigest: identifier(value.baseDependencyDigest), requestId: identifier(accounting.requestId), provider: "deepseek" as const, model: "deepseek-chat" as const, promptSchemaVersion: "flow-bootstrap.v1", inputTokens, outputTokens, totalTokens, estimatedCostUsd: cost, latencyMs };
  return Object.freeze({ ...safe, proposalDigest: createHash("sha256").update(JSON.stringify(safe)).digest("hex") });
}
