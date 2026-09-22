// The proposal-only half of the `demo-llm-create-ui` module: the
// evidence-guided exploration checkpoint. Every row here belongs to a run that
// must stop at a *proposed* adaptation -- the parser refuses one that has
// already been applied, the launcher and the UI driver carry no approve/apply
// seam at all. The explicitly authorized golden lane confirms the visible
// high-token boundary but still stops at a proposed adaptation. The driver
// also asserts the order of the panel's progress states, and answers the
// consequence dialog either way: allow after proving Cancel changes nothing,
// or refuse for good.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { DEFAULT_LLM_LAB_BUDGET } from "@fluxiq-web-extension/test-contracts";
import { AUTOMATION_STUDIO_LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD } from "fluxiq/automation-studio";
import { EVIDENCE_GUIDED_CREATION_COMMAND_TIMEOUT_MS, EVIDENCE_GUIDED_CREATION_FLOW_SETTINGS, EVIDENCE_GUIDED_CREATION_LIMITS, FIRST_LIVE_CREATION_LIMITS, LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD, classifyExplorationUiTerminal, creationSettingsFields, parseEvidenceGuidedCreationProposal, proposeEvidenceGuidedCreationViaUi } from "../index.js";
import { explorationProgressOrderIssue, refuseEvidenceGuidedCreationPermissionViaUi, settleObservedResponseText } from "../explore-proposal-ui.js";
import { readCreateUiSource } from "./module-source.js";

const root = path.resolve(import.meta.dirname, "..", "..", "..", "..", "..");

test("evidence-guided proposal parser retains only bounded proposal accounting", () => {
  const response = { ok: true, payload: { adaptation: { projectId: "project.one", flowId: "flow.one", adaptationId: "adaptation.one", status: "proposed", accounting: { provider: "deepseek", model: "deepseek-chat", inputTokens: 30_000, outputTokens: 4_000, totalTokens: 34_000, estimatedCostUsd: 0.4, raw: "discard-me" }, topology: { raw: "discard-me" } } } };
  assert.deepEqual(parseEvidenceGuidedCreationProposal(response, "project.one", "flow.one"), { adaptationId: "adaptation.one", status: "proposed", provider: "deepseek", model: "deepseek-chat", inputTokens: 30_000, outputTokens: 4_000, totalTokens: 34_000, estimatedCostUsd: 0.4 });
  assert.equal("maxCalls" in EVIDENCE_GUIDED_CREATION_LIMITS, false);
  assert.throws(() => parseEvidenceGuidedCreationProposal({ ...response, payload: { adaptation: { ...response.payload.adaptation, status: "applied" } } }, "project.one", "flow.one"), /escaped its checkpoint scope/u);
  // The aggregate bound is the run's token budget, not per-call tokens times a call count.
  const atBudget = { ...response, payload: { adaptation: { ...response.payload.adaptation, accounting: { ...response.payload.adaptation.accounting, inputTokens: EVIDENCE_GUIDED_CREATION_LIMITS.maxTotalTokensPerRun - 40_000, outputTokens: 40_000, totalTokens: EVIDENCE_GUIDED_CREATION_LIMITS.maxTotalTokensPerRun } } } };
  assert.equal(parseEvidenceGuidedCreationProposal(atBudget, "project.one", "flow.one").totalTokens, EVIDENCE_GUIDED_CREATION_LIMITS.maxTotalTokensPerRun);
  assert.throws(() => parseEvidenceGuidedCreationProposal({ ...response, payload: { adaptation: { ...response.payload.adaptation, accounting: { ...response.payload.adaptation.accounting, inputTokens: EVIDENCE_GUIDED_CREATION_LIMITS.maxTotalTokensPerRun - 4_000, outputTokens: 4_001, totalTokens: EVIDENCE_GUIDED_CREATION_LIMITS.maxTotalTokensPerRun + 1 } } } }, "project.one", "flow.one"), /aggregate bounds/u);
  assert.throws(() => parseEvidenceGuidedCreationProposal({ ...response, payload: { adaptation: { ...response.payload.adaptation, accounting: { ...response.payload.adaptation.accounting, estimatedCostUsd: 1.01 } } } }, "project.one", "flow.one"), /aggregate bounds/u);
});

test("no creation profile types a call count into Flow Settings", async () => {
  assert.equal("maxCalls" in EVIDENCE_GUIDED_CREATION_LIMITS, false);
  assert.equal("maxUses" in EVIDENCE_GUIDED_CREATION_LIMITS, false);
  assert.equal("maxCalls" in EVIDENCE_GUIDED_CREATION_FLOW_SETTINGS, false);
  assert.deepEqual(creationSettingsFields(EVIDENCE_GUIDED_CREATION_FLOW_SETTINGS).map(([label]) => label), ["Input tokens", "Output tokens", "Total tokens", "Timeout (seconds)", "Max cost (USD)", "Provider retries"]);
  // The single-call build is one call by construction; the form has no field for it.
  assert.equal(FIRST_LIVE_CREATION_LIMITS.maxCalls, 1);
  assert.deepEqual(creationSettingsFields(FIRST_LIVE_CREATION_LIMITS), [["Input tokens", "4000"], ["Output tokens", "1000"], ["Total tokens", "5000"], ["Timeout (seconds)", "20"], ["Max cost (USD)", "0.25"], ["Provider retries", "0"]]);
  const explorationSource = await readFile(path.join(root, "packages", "test-runner", "src", "demo-llm-create-ui", "explore-proposal-ui.ts"), "utf8");
  assert.doesNotMatch(explorationSource, /maxCalls|maxUses/u);
  assert.doesNotMatch(await readCreateUiSource(), /max calls/iu);
});

test("proposal-only exploration launcher and UI driver stop before review mutation", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as { scripts?: Record<string, string> };
  assert.equal(manifest.scripts?.["demo:llm:explore"], "node scripts/run-demo-llm-exploration.mjs");
  const launcher = await readFile(path.join(root, "scripts", "run-demo-llm-exploration.mjs"), "utf8");
  assert.match(launcher, /runDemoLlmExplorationCheckpoint/u);
  assert.match(launcher, /reviewOutcome: "pending"/u);
  assert.match(launcher, /applyOutcome: "not_attempted"/u);
  assert.match(launcher, /replayOutcome: "not_attempted"/u);
  assert.doesNotMatch(launcher, /DEEPSEEK_API_KEY|approveFlowAdaptation|applyFlowAdaptation|runPersistedFlow/u);
  // Both public entry points are thin: the one driver both run is the internal
  // exploration function, so that is what these rows read.
  const explorationSource = await readFile(path.join(root, "packages", "test-runner", "src", "demo-llm-create-ui", "explore-proposal-ui.ts"), "utf8");
  assert.match(proposeEvidenceGuidedCreationViaUi.toString(), /exploreEvidenceGuidedCreationViaUi\(input, "allow"\)/u);
  assert.match(refuseEvidenceGuidedCreationPermissionViaUi.toString(), /exploreEvidenceGuidedCreationViaUi\(input, "refuse"\)/u);
  const driver = explorationDriverSource(explorationSource);
  assert.match(driver, /Website task/u);
  assert.match(driver, /Explore and create proposal/u);
  assert.match(driver, /targetPage\.bringToFront/u);
  assert.ok(driver.indexOf("targetPage.bringToFront") < driver.indexOf("waitForExplorationTerminal"));
  assert.match(driver, /listFlowAdaptations/u);
  assert.doesNotMatch(driver, /Approve Adaptation|Apply Adaptation|authorizationPin/u);
  // The per-request triple and the run budget follow the shared lab budget, so
  // this pins the RELATIONSHIP rather than the numbers: ten full requests, and
  // input plus output fitting one. Pinning the numbers is how ten copies of
  // them came to disagree.
  assert.deepEqual(EVIDENCE_GUIDED_CREATION_LIMITS, {
    provider: "deepseek", model: "deepseek-chat",
    maxInputTokens: DEFAULT_LLM_LAB_BUDGET.maxInputTokens, maxOutputTokens: DEFAULT_LLM_LAB_BUDGET.maxOutputTokens,
    maxTotalTokens: DEFAULT_LLM_LAB_BUDGET.maxTotalTokensPerRequest,
    maxTotalTokensPerRun: DEFAULT_LLM_LAB_BUDGET.maxTotalTokensPerRequest * 10, timeoutSeconds: 45,
    grantClaimWindowSeconds: 60, runLeaseSeconds: 600, maxEstimatedCostUsd: 0.25, maxTotalEstimatedCostUsd: 1, providerRetries: 0,
  });
  assert.ok(EVIDENCE_GUIDED_CREATION_LIMITS.maxInputTokens + EVIDENCE_GUIDED_CREATION_LIMITS.maxOutputTokens <= EVIDENCE_GUIDED_CREATION_LIMITS.maxTotalTokens);
  // The exploration Flow's settings follow the shared budget instead of
  // restating a triple of their own. The 8,000 input tokens they used to carry
  // is the size measured as unable to describe a real page: the guard fired
  // before the request was sent and the run built nothing.
  assert.deepEqual(EVIDENCE_GUIDED_CREATION_FLOW_SETTINGS, { provider: "deepseek", model: "deepseek-chat", maxInputTokens: DEFAULT_LLM_LAB_BUDGET.maxInputTokens, maxOutputTokens: DEFAULT_LLM_LAB_BUDGET.maxOutputTokens, maxTotalTokens: DEFAULT_LLM_LAB_BUDGET.maxTotalTokensPerRequest, timeoutSeconds: 25, maxEstimatedCostUsd: 0.25, providerRetries: 0 });
  assert.deepEqual(creationSettingsFields(EVIDENCE_GUIDED_CREATION_FLOW_SETTINGS).find(([label]) => label === "Timeout (seconds)"), ["Timeout (seconds)", "25"]);
  assert.equal(EVIDENCE_GUIDED_CREATION_LIMITS.timeoutSeconds, 45);
  // The panel's command timeout: a 60 s claim window, Core's 600 s run lease, and 15 s for the reply.
  assert.equal(EVIDENCE_GUIDED_CREATION_COMMAND_TIMEOUT_MS, 675_000);
  assert.equal(EVIDENCE_GUIDED_CREATION_LIMITS.maxTotalTokensPerRun, DEFAULT_LLM_LAB_BUDGET.maxTotalTokensPerRequest * 10);
  // Core's own threshold, imported: this mirror carried the literal 100_000
  // while Core had moved to ten full requests.
  assert.equal(LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD, AUTOMATION_STUDIO_LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD);
  const workspace = await readFile(path.join(root, "packages", "test-runner", "src", "demo-workspace", "exploration-checkpoints.ts"), "utf8");
  assert.match(workspace, /configureEvidenceGuidedCreationViaUi\(panelPage, fixture\.flowTreeItemId, flowName/u);
  assert.match(workspace, /targetPage: scenarioPage/u);
  const uiSource = await readCreateUiSource();
  assert.match(uiSource, /configureCreationLimitsViaUi\(page, flowTreeItemId, pin, evidence, EVIDENCE_GUIDED_CREATION_FLOW_SETTINGS, flowName\)/u);
  assert.match(uiSource, /name: "Explore and create proposal", exact: true/u);
  assert.match(uiSource, /create-settings-flow-search/u);
  assert.match(uiSource, /getByText\(exactFlowName, \{ exact: true \}\)/u);
  assert.match(uiSource, /`\$\{exactFlowName\} actions`/u);
  assert.match(uiSource, /getByRole\("menuitem", \{ name: "Open settings", exact: true \}\)/u);
  const exactBranch = uiSource.slice(uiSource.indexOf("if (exactFlowName)"), uiSource.indexOf("} else {", uiSource.indexOf("if (exactFlowName)")));
  assert.doesNotMatch(exactBranch, /search\.fill\("Settings"\)|data-tree-parent-id/u);
  assert.match(uiSource, /exactVirtualizedHierarchyObject\(page, hierarchy, `\$\{flowTreeItemId\}-runtime-debug`/u);
  assert.match(uiSource, /data-tree-item-id/u);
  assert.match(uiSource, /element\.scrollTop = next/u);
  assert.match(uiSource, /waitForExplorationTerminal/u);
  assert.match(uiSource, /authoring\.getByRole\("alert"\)/u);
  assert.match(uiSource, /Confirm high-token Flow Build/u);
  assert.match(uiSource, /configuredProfileRequiresConfirmation: aggregateAuthorizedTokens >= LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD/u);
  assert.match(uiSource, /confirmationAttempted: true/u);
  assert.match(uiSource, /Continue high-token build/u);
  assert.match(uiSource, /ignoreHighTokenConfirmation: true/u);
  assert.match(uiSource, /options\.ignoreHighTokenConfirmation !== true[\s\S]*Confirm high-token Flow Build/u);
  assert.match(uiSource, /control\.listFlowAdaptations\(projectId, flowId, "proposed"\)/u);
  assert.match(uiSource, /Date\.now\(\) \+ EVIDENCE_GUIDED_CREATION_COMMAND_TIMEOUT_MS/u);
  assert.match(uiSource, /context\.on\("request", observeRequest\)/u);
  assert.match(uiSource, /context\.on\("response", observe\)/u);
  assert.match(uiSource, /context\.on\("requestfinished", observeFinished\)/u);
  assert.match(uiSource, /request\.response\(\)/u);
  assert.match(uiSource, /context\.off\("requestfinished", observeFinished\)/u);
  assert.match(uiSource, /apiRequestObserved: terminal\.requestObserved/u);
  assert.match(uiSource, /exploration-generation-response/u);
  assert.match(uiSource, /httpStatus: terminal\.response\.status\(\)/u);
  assert.match(uiSource, /responseOk: terminal\.response\.ok\(\)/u);
  assert.match(uiSource, /visibleGenerationErrorCode\(authoring\)/u);
  assert.match(uiSource, /exploration\.proposal-count-mismatch/u);
  assert.match(uiSource, /generationBody as Record<string, unknown>\)\.ok === true/u);
  assert.match(uiSource, /generationText = await settleObservedResponseText\(terminal\.response, 2_000\)/u);
  assert.match(uiSource, /exploration\.response-body-unsettled/u);
  assert.match(uiSource, /permissionDialogVisible/u);
  assert.match(uiSource, /sanitizeGenerationFailureBody\(terminal\.response\.status\(\), generationText\)/u);
  assert.doesNotMatch(uiSource, /terminal\.response\.json\(\)|readSanitizedGenerationFailure\(terminal\.response\)/u);
  assert.doesNotMatch(uiSource, /waitForEndpoint\(page, "generate-flow-bootstrap-adaptation", \(\) => explore\.click\(\), 190_000\)/u);
});

test("exploration UI terminal classifier stops at high-token confirmation without treating it as an alert", () => {
  assert.deepEqual(classifyExplorationUiTerminal({ highTokenConfirmationVisible: true, alertVisible: false, requestObserved: false }), {
    kind: "high_token_confirmation",
    requestObserved: false,
  });
  assert.deepEqual(classifyExplorationUiTerminal({ highTokenConfirmationVisible: true, alertVisible: true, requestObserved: true }), {
    kind: "high_token_confirmation",
    requestObserved: true,
  });
  assert.deepEqual(classifyExplorationUiTerminal({ highTokenConfirmationVisible: false, alertVisible: true, requestObserved: true }), {
    kind: "ui_failure",
    requestObserved: true,
  });
  assert.equal(classifyExplorationUiTerminal({ highTokenConfirmationVisible: false, alertVisible: false, requestObserved: false }), undefined);
  assert.equal(Math.max(EVIDENCE_GUIDED_CREATION_LIMITS.maxTotalTokensPerRun, EVIDENCE_GUIDED_CREATION_LIMITS.maxTotalTokens) >= LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD, true);
});

test("external response-body observation is bounded independently of the product UI", async () => {
  assert.equal(await settleObservedResponseText({ text: async () => "bounded" }, 1), "bounded");
  assert.equal(await settleObservedResponseText({ text: () => new Promise<string>(() => undefined) }, 1), undefined);
});

test("progress must prepare before inspecting and end on its terminal state, never regressing after it", () => {
  assert.equal(explorationProgressOrderIssue(["preparing", "inspecting", "ready_for_review"], "proposal"), undefined);
  // A confirmed high-token build and a permission continuation each prepare again.
  assert.equal(explorationProgressOrderIssue(["preparing", "inspecting", "permission_pending", "preparing", "inspecting", "ready_for_review"], "proposal"), undefined);
  assert.equal(explorationProgressOrderIssue(["preparing", "inspecting", "permission_pending"], "permission_request"), undefined);
  assert.equal(explorationProgressOrderIssue(["inspecting", "ready_for_review"], "proposal"), "progress.preparing_missing");
  assert.equal(explorationProgressOrderIssue(["inspecting", "preparing", "inspecting", "ready_for_review"], "proposal"), "progress.preparing_missing");
  assert.equal(explorationProgressOrderIssue(["preparing", "ready_for_review"], "proposal"), "progress.inspecting_missing");
  assert.equal(explorationProgressOrderIssue([], "proposal"), "progress.inspecting_missing");
  assert.equal(explorationProgressOrderIssue(["preparing", "inspecting"], "proposal"), "progress.review_missing");
  assert.equal(explorationProgressOrderIssue(["preparing", "ready_for_review", "inspecting"], "proposal"), "progress.review_missing");
  assert.equal(explorationProgressOrderIssue(["preparing", "inspecting", "ready_for_review"], "permission_request"), "progress.permission_pending_missing");
  assert.equal(explorationProgressOrderIssue(["preparing", "inspecting", "permission_pending", "preparing"], "permission_request"), "progress.regressed");
});

test("the progress observer is installed before the click and reads only Core's own progress labels", async () => {
  const source = await readFile(path.join(root, "packages", "test-runner", "src", "demo-llm-create-ui", "explore-proposal-ui.ts"), "utf8");
  const driver = explorationDriverSource(source);
  assert.ok(driver.indexOf("watchExplorationProgress(page)") >= 0);
  assert.ok(driver.indexOf("watchExplorationProgress(page)") < driver.indexOf("explore-target-reactivate"));
  assert.ok(driver.indexOf("explore-target-reactivate") < driver.indexOf("waitForExplorationTerminal"));
  assert.match(driver, /assertProgressOrder\(evidence, await settledProgress\(page, progress, "ready_for_review"\), "proposal"\)/u);
  // The labels are Core's: the authoring panel and its model, in the sibling Core checkout this package links.
  const coreAuthoring = path.join(root, "..", "!FluxIQ", "apps", "web", "src", "features", "automation-studio", "authoring");
  const panel = await readFile(path.join(coreAuthoring, "BlankFlowAuthoringPanel.tsx"), "utf8");
  const model = await readFile(path.join(coreAuthoring, "blank-flow-authoring-model.ts"), "utf8");
  for (const label of ['progress[aria-label="Preparing website exploration"]', 'progress[aria-label="Inspecting live target"]', "Ready for review.", "Flow action approval is still required."]) assert.ok(source.includes(label), label);
  assert.match(panel, /<progress aria-label="Preparing website exploration" \/>/u);
  assert.match(panel, /<progress aria-label=\{AUTOMATION_LLM_PROGRESS_LABELS\.inspectingLiveTarget\} \/>/u);
  assert.match(model, /inspectingLiveTarget: "Inspecting live target"/u);
  assert.match(panel, /<strong>\{AUTOMATION_LLM_PROGRESS_LABELS\.readyForReview\}\.<\/strong>/u);
  assert.match(model, /readyForReview: "Ready for review"/u);
  assert.match(panel, /<strong>Flow action approval is still required\.<\/strong>/u);
  assert.match(panel, /aria-label="Build Flow from instructions"/u);
});

test("the refuse path cancels for good: it never reopens or allows, and proves no proposal or Flow change follows", async () => {
  const source = await readFile(path.join(root, "packages", "test-runner", "src", "demo-llm-create-ui", "explore-proposal-ui.ts"), "utf8");
  const driver = explorationDriverSource(source);
  const refuse = source.slice(source.indexOf("async function refuseRetainedPermission"), source.indexOf("async function assertProgressOrder"));
  assert.ok(refuse.length > 0);
  // The refusal returns after the Cancel checks and before the reopen and the allow.
  assert.ok(driver.indexOf("explore-permission-cancel") < driver.indexOf('decision === "refuse"'));
  assert.ok(driver.indexOf('decision === "refuse"') < driver.indexOf("explore-permission-reopen"));
  assert.ok(driver.indexOf('decision === "refuse"') < driver.indexOf("Allow and continue"));
  assert.doesNotMatch(refuse, /Allow and continue|explore-permission-reopen|\.click\(/u);
  assert.match(refuse, /Review requested permissions/u);
  assert.match(refuse, /listFlowAdaptations\(projectId, flowId, "proposed"\)\)\.length !== 0\) fail\("Refusing permission created a proposal"\)/u);
  assert.match(refuse, /contentHash !== blankContentHash\) fail\("Refusing permission mutated the blank Flow"\)/u);
  assert.match(refuse, /settledProgress\(page, input\.progress, "permission_pending"\)/u);
  // A model that never asks leaves the refusal unverified rather than passed.
  assert.match(refuseEvidenceGuidedCreationPermissionViaUi.toString(), /permission\.not_requested/u);
  assert.match(refuseEvidenceGuidedCreationPermissionViaUi.toString(), /verification: "unverified"/u);
  assert.doesNotMatch(source, /Approve Adaptation|Apply Adaptation|authorizationPin/u);
});

/** The one exploration driver both entry points run, from its declaration to the next top-level declaration. */
function explorationDriverSource(source: string): string {
  const start = source.indexOf("async function exploreEvidenceGuidedCreationViaUi");
  assert.ok(start >= 0, "the internal exploration driver is present");
  return source.slice(start, source.indexOf("\n/** How long the panel may take", start));
}
