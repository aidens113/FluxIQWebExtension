// Approving and applying a proposal that already exists, without generating a
// new one. Every step is re-checked against the control client: the proposal
// must still be the exact pending Flow bootstrap bound to the same base
// digest, the Flow must still be blank at approval, and the provider-call
// audit recorded when it was proposed must survive the apply unchanged.

import type { Page, Request } from "@playwright/test";
import type { BrowserEvidenceRecorder } from "../browser-evidence.js";
import { ExistingFluxIQControlClient } from "../existing-fluxiq-control.js";
import { inspectAppliedCreation, parseAppliedExecutionDigest } from "./adaptation-lifecycle.js";
import { watchAppliedBinding } from "./applied-binding.js";
import type { LiveCreationTopology } from "./creation-outcomes.js";
import { exactVirtualizedHierarchyObject, exactVisible, review } from "./panel-interaction.js";
import { fail, inspectionFail } from "./runner-fail.js";

export type ApplyExistingEvidenceGuidedCreationInput = Readonly<{
  page: Page;
  flowTreeItemId: string;
  projectId: string;
  flowId: string;
  adaptationId: string;
  pin: string;
  evidence: BrowserEvidenceRecorder;
  control: ExistingFluxIQControlClient;
  blankContentHash: string;
  baseExecutionDigest: string;
}>;

export async function approveApplyExistingEvidenceGuidedCreationViaUi(input: ApplyExistingEvidenceGuidedCreationInput): Promise<LiveCreationTopology> {
  const { page, flowTreeItemId, projectId, flowId, adaptationId, pin, evidence, control, blankContentHash, baseExecutionDigest } = input;
  await page.context().addCookies([{ name: "fluxiq_session", value: control.sessionCookieValue(), url: new URL(page.url()).origin }]);
  const before = await control.getFlowAdaptation(projectId, flowId, adaptationId);
  if (before.status !== "proposed" || before.adaptationKind !== "flow_bootstrap" || !before.evidenceLoop
    || before.bootstrapBinding?.baseExecutionDigest !== baseExecutionDigest
    || before.bootstrapBinding.currentExecutionDigest !== baseExecutionDigest) {
    fail("Exact pending evidence-guided proposal changed before UI review");
  }
  const historicalProviderCallCount = before.evidenceLoop.providerCallCount;
  if ((await control.getExactFlow(projectId, flowId)).contentHash !== blankContentHash) fail("Blank checkpoint Flow changed before UI review");

  const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
  const search = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
  await evidence.step("panel", "exploration-apply-adaptations-search", "Search the exact checkpoint Flow for Adaptations", () => search.fill("Adaptations"));
  const rows = await exactVirtualizedHierarchyObject(page, hierarchy, `${flowTreeItemId}-adaptations`, "the exact checkpoint Flow Adaptations row", ".tree-row-main.type-folder");
  await evidence.step("panel", "exploration-apply-adaptations-open", "Open Adaptations for the exact checkpoint Flow", () => rows.click());
  await evidence.step("panel", "exploration-apply-runtime-search-clear", "Clear hierarchy search", () => search.fill(""));
  await exactVisible(page.getByRole("table", { name: "Adaptations", exact: true }), "the checkpoint Flow Adaptations table", 30_000);
  const proposal = page.getByText(adaptationId, { exact: true });
  await exactVisible(proposal, "the exact pending evidence-guided proposal", 30_000);
  await evidence.step("panel", "exploration-apply-select", "Select the exact pending evidence-guided proposal", () => proposal.click());
  await page.getByText("Adaptation Detail", { exact: true }).waitFor({ timeout: 30_000 });
  const audit = page.getByRole("button", { name: "Audit", exact: true });
  await exactVisible(audit, "the Adaptation Audit tab");
  await evidence.step("panel", "exploration-apply-audit", "Review the exact pending proposal audit", () => audit.click());
  await review(page, evidence, pin, "Approve Adaptation", "Approve", "exploration-apply-approve");
  const approved = await control.getFlowAdaptation(projectId, flowId, adaptationId);
  if (approved.status !== "validated" || approved.bootstrapBinding?.baseExecutionDigest !== baseExecutionDigest
    || approved.bootstrapBinding.currentExecutionDigest !== baseExecutionDigest
    || (await control.getExactFlow(projectId, flowId)).contentHash !== blankContentHash) {
    fail("Approved evidence-guided proposal or blank Flow changed before apply");
  }
  const laterRequests = new Map<string, number>();
  let applyAnswered = false;
  const observeLater = (request: Request) => {
    if (!applyAnswered || request.method() !== "POST") return;
    const match = /^\/api\/programs\/([a-z0-9-]{1,30})\/([a-z0-9-]{1,32})$/u.exec(new URL(request.url()).pathname);
    if (match) laterRequests.set(`${match[1]}.${match[2]}`, (laterRequests.get(`${match[1]}.${match[2]}`) ?? 0) + 1);
  };
  page.context().on("request", observeLater);
  try {
    const applyResponse = await review(page, evidence, pin, "Apply Adaptation", "Apply Changes", "exploration-apply-apply");
    applyAnswered = true;
    const resultingDigest = parseAppliedExecutionDigest(await applyResponse.json(), applyResponse.ok(), baseExecutionDigest);
    // Read once before the inspection below, which reads the new graph's
    // viewport: that tells a change made by the read apart from one made by
    // the panel or by Core after apply.
    const beforeInspection = (await control.getFlowAdaptation(projectId, flowId, adaptationId)).bootstrapBinding;
    const heldBeforeInspection = Boolean(beforeInspection?.appliedExecutionDigest)
      && beforeInspection?.currentExecutionDigest === beforeInspection?.appliedExecutionDigest;
    const topology = await inspectAppliedCreation(control, projectId, flowId, baseExecutionDigest, resultingDigest);
    const applied = await control.getFlowAdaptation(projectId, flowId, adaptationId);
    if (applied.status !== "applied" || applied.appliedMutationCount === undefined || applied.appliedMutationCount < 1) {
      fail("The exact evidence-guided proposal did not persist as applied");
    }
    if (applied.evidenceLoop?.providerCallCount !== historicalProviderCallCount) fail("Proposal apply changed the persisted provider-call audit");
    // The next step runs this Flow as the application Core recorded, so the
    // binding must still be that application once the panel has settled.
    let settingsRevision: number | undefined;
    const watch = await watchAppliedBinding(async () => {
      const binding = (await control.getFlowAdaptation(projectId, flowId, adaptationId)).bootstrapBinding;
      settingsRevision = binding?.currentSettingsRevision;
      return { ...(binding?.appliedExecutionDigest ? { applied: binding.appliedExecutionDigest } : {}), ...(binding?.currentExecutionDigest ? { current: binding.currentExecutionDigest } : {}) };
    }, { settleMs: APPLIED_BINDING_SETTLE_MS, intervalMs: 500, expectedApplied: resultingDigest });
    for (const [endpoint, count] of [...laterRequests].slice(0, 16)) {
      await evidence.diagnostic("panel", "exploration-apply-later-request", endpoint.slice(0, 64), { count });
    }
    if (watch.driftedAtMs !== undefined) {
      await evidence.diagnostic("panel", "exploration-apply-binding", "exploration_apply.applied_binding_drifted", {
        driftedAtMs: Math.min(watch.driftedAtMs, 1_000_000), reads: watch.reads, heldBeforeInspection,
        settingsRevisionKnown: settingsRevision !== undefined, settingsRevision: Math.min(settingsRevision ?? 0, 1_000_000),
        laterRequestKinds: laterRequests.size,
      });
      inspectionFail("The applied Flow's execution state moved away from the application Core recorded", "exploration_apply.applied_binding_drifted");
    }
    return topology;
  } finally {
    page.context().off("request", observeLater);
  }
}

/** How long the applied binding must hold after apply before the step reports success. */
const APPLIED_BINDING_SETTLE_MS = 5_000;
