import { createHash } from "node:crypto";
import type { Locator, Page, Request, Response } from "@playwright/test";
import type { BrowserEvidenceRecorder } from "./browser-evidence.js";
import { AUTOMATION_STUDIO_ENDPOINTS, AUTOMATION_STUDIO_FLOW_BOOTSTRAP_GENERATION_READINESS, AUTOMATION_STUDIO_FLOW_BOOTSTRAP_PHASE_FAILURE_CODES, parseAutomationStudioFlowBootstrapFailureDiagnostic, parseAutomationStudioFlowBootstrapGenerationReadiness, type AutomationStudioFlowBootstrapFailureStage, type AutomationStudioFlowBootstrapPhaseFailureCode } from "fluxiq/automation-studio";
import { RunnerFailure } from "./failure.js";
import { ExistingFluxIQControlClient } from "./existing-fluxiq-control.js";
import { TESTING_LAB_DEEPSEEK_KEY_NAME } from "./secret-keys-ui.js";

export const FIRST_LIVE_CREATION_LIMITS = Object.freeze({
  provider: "deepseek", model: "deepseek-chat", maxInputTokens: 4000, maxOutputTokens: 1000,
  maxTotalTokens: 5000, maxCalls: 1, timeoutSeconds: 20, maxEstimatedCostUsd: 0.25, providerRetries: 0,
});
export const EVIDENCE_GUIDED_CREATION_LIMITS = Object.freeze({
  provider: "deepseek", model: "deepseek-chat", maxInputTokens: 8_000, maxOutputTokens: 4_000,
  maxTotalTokens: 12_000, maxCalls: 4, maxUses: 4, timeoutSeconds: 45,
  maxEstimatedCostUsd: 0.25, maxTotalEstimatedCostUsd: 1, providerRetries: 0,
});
export const EVIDENCE_GUIDED_CREATION_FLOW_SETTINGS = Object.freeze({
  provider: "deepseek", model: "deepseek-chat", maxInputTokens: 8_000, maxOutputTokens: 4_000,
  maxTotalTokens: 12_000, maxCalls: 4, timeoutSeconds: 25,
  maxEstimatedCostUsd: 0.25, providerRetries: 0,
});
export const LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD = 100_000;
export const EVIDENCE_GUIDED_CREATION_COMMAND_TIMEOUT_MS = EVIDENCE_GUIDED_CREATION_LIMITS.maxCalls * EVIDENCE_GUIDED_CREATION_LIMITS.timeoutSeconds * 1_000 + 15_000;

export type EvidenceGuidedCreationCheckpoint = Readonly<{
  adaptationId: string; status: "proposed"; provider: "deepseek"; model: "deepseek-chat";
  providerCallCount: number; toolCallCount: number; evidenceBytes: number; toolIds: string[];
  inputTokens: number; outputTokens: number; totalTokens: number; estimatedCostUsd: number;
}>;

export type LiveCreationGeneration = Readonly<{
  adaptationId: string; baseExecutionDigest: string; proposalDigest: string; requestId: string;
  provider: "deepseek"; model: "deepseek-chat"; promptSchemaVersion: string;
  inputTokens: number; outputTokens: number; totalTokens: number; estimatedCostUsd: number; latencyMs: number;
}>;

export type LiveCreationTopology = Readonly<{
  resultingExecutionDigest: string; routerId: string; routerSubflowId: string; ownedSubflowId: string;
  graphFlowId: string; nodeCount: number; edgeCount: number; executableNodeCount: number;
  overlappingPositionCount: 0; recordingProvenanceAbsent: true;
}>;

export type SanitizedSettingsSaveFailure = Readonly<{
  status: number;
  code: string;
  responseBytes: number;
  parsed: boolean;
  revisionBothParsed: boolean;
  revisionRelation: "expected_lt" | "expected_eq" | "expected_gt" | "unknown";
  revisionAbsoluteDelta: number | null;
}>;
export type SanitizedGenerationFailure = Readonly<{
  status: number;
  code: string;
  reasonCode: AutomationStudioFlowBootstrapPhaseFailureCode | null;
  responseBytes: number;
  parsed: boolean;
  providerCallKnown: boolean;
  providerCallCount: number;
  accountingKnown: boolean;
  accountingAvailable: boolean;
  evidenceLoop?: Readonly<{
    iterationCount: number;
    decisionCount: number;
    toolCallCount: number;
    evidenceBytes: number;
    steps?: ReadonlyArray<Readonly<{ toolId: string; effectApplied?: boolean; resultCode?: string }>>;
  }>;
  evidenceSteps?: ReadonlyArray<Readonly<{ toolId: string; effectApplied?: boolean; resultCode?: string }>>;
  estimatedInputTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}>;
const MAX_REPORTED_REVISION_DELTA = 1_000_000;
export async function rejectStalePendingCreationAdaptation(
  control: Pick<ExistingFluxIQControlClient, "listFlowAdaptations" | "getFlowAdaptation" | "rejectFlowAdaptation">,
  projectId: string,
  flowId: string,
  pin: string,
): Promise<number> {
  const proposed = await control.listFlowAdaptations(projectId, flowId, "proposed");
  if (proposed.length === 0) return 0;
  if (proposed.length !== 1) fail("Expected at most one pending adaptation on the isolated creation Flow");
  const candidate = await control.getFlowAdaptation(projectId, flowId, proposed[0]!.adaptationId);
  if (candidate.status !== "proposed" || candidate.adaptationKind !== "flow_bootstrap") {
    fail("The isolated creation Flow has a pending adaptation that is not a Flow bootstrap proposal");
  }
  const rejected = await control.rejectFlowAdaptation({
    projectId,
    flowId,
    adaptationId: candidate.adaptationId,
    authorizationPin: pin,
    reason: "Testing Lab stale pending creation cleanup",
  });
  if (rejected.adaptationKind !== "flow_bootstrap") fail("FluxIQ rejected an unexpected adaptation kind");
  return 1;
}
export async function configureFirstLiveCreationViaUi(page: Page, flowTreeItemId: string, pin: string, evidence: BrowserEvidenceRecorder): Promise<void> {
  await configureCreationLimitsViaUi(page, flowTreeItemId, pin, evidence, FIRST_LIVE_CREATION_LIMITS);
}
export async function configureEvidenceGuidedCreationViaUi(page: Page, flowTreeItemId: string, flowName: string, pin: string, evidence: BrowserEvidenceRecorder): Promise<void> {
  return configureCreationLimitsViaUi(page, flowTreeItemId, pin, evidence, EVIDENCE_GUIDED_CREATION_FLOW_SETTINGS, flowName).then(() => undefined);
}
type CreationSettingsLimits = typeof FIRST_LIVE_CREATION_LIMITS | typeof EVIDENCE_GUIDED_CREATION_FLOW_SETTINGS;

export function creationSettingsFields(limits: CreationSettingsLimits) {
  return [["Input tokens", String(limits.maxInputTokens)], ["Output tokens", String(limits.maxOutputTokens)], ["Total tokens", String(limits.maxTotalTokens)], ["Max calls", String(limits.maxCalls)], ["Timeout (seconds)", String(limits.timeoutSeconds)], ["Max cost (USD)", String(limits.maxEstimatedCostUsd)], ["Provider retries", String(limits.providerRetries)]] as const;
}

async function configureCreationLimitsViaUi(page: Page, flowTreeItemId: string, pin: string, evidence: BrowserEvidenceRecorder, limits: CreationSettingsLimits, exactFlowName?: string): Promise<void> {
  const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
  const search = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
  if (exactFlowName) {
    await evidence.step("panel", "create-settings-flow-search", "Re-resolve the exact exploration Flow before opening Settings", () => search.fill(exactFlowName));
    const flows = hierarchy.locator(".automation-tree-item").filter({ has: page.locator(".tree-row-main.type-flow .tree-row-label > strong").getByText(exactFlowName, { exact: true }) });
    await exactVisible(flows, "the exact exploration Flow hierarchy item");
    const current = flows.first();
    await evidence.step("panel", "create-settings-flow-open", "Restore the exact exploration Flow selection", () => current.locator(".tree-row-main.type-flow").click());
    const actions = current.getByRole("button", { name: `${exactFlowName} actions`, exact: true });
    await exactVisible(actions, "the exact exploration Flow actions menu");
    await evidence.step("panel", "create-settings-flow-actions", "Open the exact exploration Flow actions", () => actions.click());
    const openSettings = page.getByRole("menuitem", { name: "Open settings", exact: true });
    await exactVisible(openSettings, "the exact exploration Flow Open settings action");
    await evidence.step("panel", "create-settings-open", "Open this Flow's Settings", () => openSettings.click());
  } else {
    await evidence.step("panel", "create-settings-search", "Search this Flow for Settings", () => search.fill("Settings"));
    const rows = await exactVirtualizedHierarchyObject(page, hierarchy, `${flowTreeItemId}-settings`, "the exact Flow Settings row");
    await evidence.step("panel", "create-settings-open", "Open this Flow's Settings", () => rows.click());
  }
  const workspace = page.locator(".automation-flow-settings-workspace");
  await workspace.waitFor({ state: "visible", timeout: 30_000 });
  await evidence.step("panel", "create-settings-search-clear", "Clear hierarchy search", () => search.fill(""));
  await workspace.getByText("Loading saved Flow settings...", { exact: true }).waitFor({ state: "hidden", timeout: 30_000 });
  const section = workspace.getByRole("navigation", { name: "Flow settings sections", exact: true }).locator('button[aria-controls="flow-settings-llm"]');
  await exactVisible(section, "the LLM Connection settings section");
  await evidence.step("panel", "create-settings-section", "Open LLM Connection settings", () => section.click());
  const root = workspace.locator("#flow-settings-llm");
  await setSelect(root, "Provider", "deepseek", page, evidence);
  await setSelect(root, "Model", "deepseek-chat", page, evidence);
  const key = workspace.getByRole("combobox", { name: "Encrypted API key", exact: true });
  await exactVisible(key, "the encrypted API key selector");
  if (await key.inputValue() !== TESTING_LAB_DEEPSEEK_KEY_NAME) {
    await evidence.step("panel", "create-settings-key", "Select the stored Testing Lab DeepSeek key", async () => {
      await key.fill(TESTING_LAB_DEEPSEEK_KEY_NAME);
      const option = workspace.getByRole("option", {
        name: new RegExp(`^${escapeRegExp(TESTING_LAB_DEEPSEEK_KEY_NAME)}`, "u"),
      });
      await exactVisible(option, "the stored Testing Lab DeepSeek key option");
      await option.click();
    });
  }
  if (await key.inputValue() !== TESTING_LAB_DEEPSEEK_KEY_NAME) fail("The exact stored Testing Lab DeepSeek key was not selected");
  const fields = creationSettingsFields(limits);
  for (const [label, value] of fields) {
    const input = root.getByLabel(label, { exact: true });
    await exactVisible(input, `the exact ${label} setting`);
    if (await input.inputValue() !== value) await evidence.step("panel", `create-settings-${slug(label)}`, `Set ${label}`, () => input.fill(value));
  }
  const save = workspace.getByRole("button", { name: "Save Settings", exact: true });
  if (await save.isEnabled()) {
    await evidence.step("panel", "create-settings-save", "Request saving bounded Flow settings", () => save.click());
    const dialog = page.getByRole("dialog", { name: "Authorize Flow Settings Save", exact: true });
    await exactVisible(dialog, "the Flow Settings authorization dialog");
    await evidence.step("panel", "create-settings-pin", "Authorize bounded Flow Settings", () => dialog.getByLabel("Security PIN", { exact: true }).fill(pin), { sensitive: true });
    const saveResponse = await evidence.step("panel", "create-settings-authorize", "Save bounded Flow Settings", () => waitForEndpoint(page, "update-flow-settings", () => dialog.getByRole("button", { name: "Authorize and Save", exact: true }).click()), { sensitive: true });
    if (!saveResponse.ok()) {
      const failure = await readSanitizedSettingsSaveFailure(saveResponse);
      await evidence.diagnostic("panel", "settings-save-rejected", failure.code, {
        httpStatus: failure.status,
        responseBytes: failure.responseBytes,
        responseParsed: failure.parsed,
        revisionBothParsed: failure.revisionBothParsed,
        revisionExpectedLt: failure.revisionRelation === "expected_lt",
        revisionExpectedEq: failure.revisionRelation === "expected_eq",
        revisionExpectedGt: failure.revisionRelation === "expected_gt",
        revisionAbsoluteDelta: failure.revisionAbsoluteDelta ?? 0,
      });
      fail(`Flow Settings save was rejected (${failure.code})`);
    }
    await dialog.waitFor({ state: "hidden", timeout: 30_000 });
  }
  await workspace.getByText("All Flow settings saved", { exact: true }).waitFor({ timeout: 30_000 });
  for (const [label, value] of fields) if (await root.getByLabel(label, { exact: true }).inputValue() !== value) fail("Saved LLM limits differ from the certified creation profile");
}

type BuildApproveApplyCreationInput = {
  page: Page; flowTreeItemId: string; projectId: string; flowId: string; pin: string;
  evidence: BrowserEvidenceRecorder; control: ExistingFluxIQControlClient; blankContentHash: string;
};
type BuildApproveApplyCreationResult = { generation: LiveCreationGeneration; topology: LiveCreationTopology };

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

export async function inspectAppliedCreation(control: ExistingFluxIQControlClient, projectId: string, flowId: string, baseDigest: string, canonicalResultingDigest: string): Promise<LiveCreationTopology> {
  const subflows = await control.listFlowSubflows(projectId, flowId);
  if (subflows.length !== 1 || !subflows[0]!.graphFlowId) inspectionFail("Applied creation must own exactly one graph-backed Subflow", "exploration_apply.subflow_topology_invalid");
  const owned = subflows[0]!;
  const graphFlowId = owned.graphFlowId;
  if (!graphFlowId) inspectionFail("Applied creation Subflow omitted its graph Flow identity", "exploration_apply.graph_identity_missing");
  const router = await control.getFlowRouter(projectId, flowId);
  if (!router) inspectionFail("Applied creation did not create a Router", "exploration_apply.router_missing");
  const routed = [router.fallback, ...router.rules.map(rule => rule.target)].filter(target => target?.kind === "subflow" && target.subflowId === owned.subflowId);
  if (routed.length !== 1) inspectionFail("Applied creation must route exactly once to its owned Subflow", "exploration_apply.route_invalid");
  const graph = await control.getExactFlow(projectId, graphFlowId);
  const viewport = await control.getFlowGraphViewport(projectId, graphFlowId);
  const nodes = Array.isArray(graph.document.nodes) ? graph.document.nodes as Record<string, unknown>[] : [];
  const edges = Array.isArray(graph.document.edges) ? graph.document.edges : [];
  if (!nodes.length || edges.length < Math.max(0, nodes.length - 1) || viewport.nodeCount !== nodes.length || viewport.edgeCount !== edges.length) inspectionFail("Applied creation graph is empty, disconnected, or inconsistent", "exploration_apply.graph_invalid");
  const definitions = new Map((await control.listNativeNodeDefinitions(projectId)).map(item => [item.id, item]));
  const resolved = nodes.filter(node => typeof node.definitionId === "string" && (
    definitions.has(node.definitionId)
    || node.definitionId === "builtin.control.start"
    || node.definitionId === "builtin.control.end"
  )).length;
  if (resolved !== nodes.length) inspectionFail("Applied creation contains an unsupported node definition", "exploration_apply.node_definition_missing");
  const executable = nodes.filter(node => typeof node.definitionId === "string" && definitions.get(node.definitionId)?.executable).length;
  if (executable < 1) inspectionFail("Applied creation contains no executable output node", "exploration_apply.node_not_executable");
  let overlaps = 0;
  for (let i = 0; i < viewport.nodes.length; i++) for (let j = i + 1; j < viewport.nodes.length; j++) {
    const a = viewport.nodes[i]!, b = viewport.nodes[j]!;
    if (Math.abs(a.x - b.x) < 220 && Math.abs(a.y - b.y) < 96) overlaps += 1;
  }
  if (overlaps) inspectionFail("Applied creation graph positions overlap", "exploration_apply.positions_overlap");
  const serialized = JSON.stringify([await control.getExactFlow(projectId, flowId), graph, router, subflows]);
  if (/lastRecordingId|sourceRecordingIds|recordingProvenance|recordingId/iu.test(serialized)) inspectionFail("Applied creation contains recording provenance", "exploration_apply.recording_provenance_present");
  const resultingExecutionDigest = identifier(canonicalResultingDigest);
  if (resultingExecutionDigest === baseDigest) inspectionFail("Applied creation did not change the canonical Core execution digest", "exploration_apply.digest_unchanged");
  return Object.freeze({ resultingExecutionDigest, routerId: router.routerId, routerSubflowId: owned.subflowId, ownedSubflowId: owned.subflowId, graphFlowId, nodeCount: nodes.length, edgeCount: edges.length, executableNodeCount: executable, overlappingPositionCount: 0 as const, recordingProvenanceAbsent: true as const });
}

export async function readSanitizedSettingsSaveFailure(response: Pick<Response, "status" | "headers" | "text">): Promise<SanitizedSettingsSaveFailure> {
  const status = response.status();
  let body = "";
  try { body = await response.text(); } catch { /* response remains classified by status */ }
  const responseBytes = Math.min(Buffer.byteLength(body, "utf8"), 1_000_000);
  if (!body || responseBytes > 4096) return sanitizedSettingsFailure(status, settingsFailureCode(status), responseBytes, false);
  let error = "";
  try {
    const parsed = JSON.parse(body) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && typeof (parsed as Record<string, unknown>).error === "string") {
      error = ((parsed as Record<string, unknown>).error as string).slice(0, 512).toLowerCase();
    }
  } catch { return sanitizedSettingsFailure(status, settingsFailureCode(status), responseBytes, false); }
  return sanitizedSettingsFailure(status, settingsFailureCode(status, error), responseBytes, true, error);
}

function sanitizedSettingsFailure(status: number, code: string, responseBytes: number, parsed: boolean, error = ""): SanitizedSettingsSaveFailure {
  const revisions = parseOptimisticRevisionConflict(error);
  return Object.freeze({ status, code, responseBytes, parsed, ...revisions });
}

function parseOptimisticRevisionConflict(error: string): Pick<SanitizedSettingsSaveFailure, "revisionBothParsed" | "revisionRelation" | "revisionAbsoluteDelta"> {
  const match = /\bflow_save_conflict\b[^\r\n]{0,256}?\bexpected\s+(\d{1,40})\s*,\s*current\s+(\d{1,40})\b/iu.exec(error);
  if (!match?.[1] || !match[2]) return { revisionBothParsed: false, revisionRelation: "unknown", revisionAbsoluteDelta: null };
  try {
    const expected = BigInt(match[1]);
    const current = BigInt(match[2]);
    const relation = expected < current ? "expected_lt" : expected > current ? "expected_gt" : "expected_eq";
    const delta = expected > current ? expected - current : current - expected;
    return {
      revisionBothParsed: true,
      revisionRelation: relation,
      revisionAbsoluteDelta: delta > BigInt(MAX_REPORTED_REVISION_DELTA) ? MAX_REPORTED_REVISION_DELTA : Number(delta),
    };
  } catch {
    return { revisionBothParsed: false, revisionRelation: "unknown", revisionAbsoluteDelta: null };
  }
}

function settingsFailureCode(status: number, error = ""): string {
  if (/pin|authoriz|forbidden|permission/iu.test(error)) return "settings-save.authorization";
  if (/flow_save_conflict|conflict|changed elsewhere/iu.test(error)) return "settings-save.conflict";
  if (/input and output limits|total-token/iu.test(error)) return "settings-save.token-total";
  if (/llm|deepseek|provider retr|estimated-cost|exactly one llm call/iu.test(error)) return "settings-save.llm-policy";
  if (/flow settings are required|flow.+not found/iu.test(error)) return "settings-save.flow";
  return Number.isInteger(status) && status >= 100 && status <= 599 ? `settings-save.http-${status}` : "settings-save.http-unknown";
}
export type ProviderFreeGenerationReadiness = Readonly<{
  compatible: boolean;
  status: number;
  responseBytes: number;
  parsed: boolean;
  code: "readiness.ready" | "readiness.http-rejected" | "readiness.response-invalid" | "readiness.runtime-unavailable";
  supported: boolean;
  llmExecutionGrantsConfigured: boolean;
  providerResolverConfigured: boolean;
  nativeNodeRegistryConfigured: boolean;
}>;

export async function assertProviderFreeGenerationReadiness(page: Page, evidence: BrowserEvidenceRecorder): Promise<ProviderFreeGenerationReadiness> {
  const endpoint = new URL(`/api/programs/automation-studio/${AUTOMATION_STUDIO_ENDPOINTS.getFlowBootstrapGenerationReadiness}?domainId=web-automation`, page.url()).toString();
  const response = await evidence.step("panel", "generation-readiness-probe", "Verify provider-free Flow Bootstrap generation compatibility", () => page.request.get(endpoint, {
    failOnStatusCode: false,
    timeout: 10_000,
  }));
  const readiness = await readProviderFreeGenerationReadiness(response);
  if (!readiness.compatible) {
    await evidence.diagnostic("panel", "generation-readiness-rejected", readiness.code, {
      httpStatus: readiness.status,
      responseBytes: readiness.responseBytes,
      responseParsed: readiness.parsed,
      supported: readiness.supported,
      llmExecutionGrantsConfigured: readiness.llmExecutionGrantsConfigured,
      providerResolverConfigured: readiness.providerResolverConfigured,
      nativeNodeRegistryConfigured: readiness.nativeNodeRegistryConfigured,
    });
    fail("Running FluxIQ panel does not expose certified provider-free generation readiness");
  }
  return readiness;
}

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
  const applyResponse = await review(page, evidence, pin, "Apply Adaptation", "Apply Changes", "exploration-apply-apply");
  const resultingDigest = parseAppliedExecutionDigest(await applyResponse.json(), applyResponse.ok(), baseExecutionDigest);
  const topology = await inspectAppliedCreation(control, projectId, flowId, baseExecutionDigest, resultingDigest);
  const applied = await control.getFlowAdaptation(projectId, flowId, adaptationId);
  if (applied.status !== "applied" || applied.appliedMutationCount === undefined || applied.appliedMutationCount < 1) {
    fail("The exact evidence-guided proposal did not persist as applied");
  }
  if (applied.evidenceLoop?.providerCallCount !== historicalProviderCallCount) fail("Proposal apply changed the persisted provider-call audit");
  return topology;
}

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
  const terminal = await evidence.step("panel", "explore-propose", "Explore the connected website and create one reviewable proposal", () => waitForExplorationTerminal(page, authoring, control, projectId, flowId, () => explore.click()));
  if (terminal.kind === "ui_failure") {
    await evidence.diagnostic("panel", "exploration-ui-terminal", "exploration.ui-terminal-failure", { apiRequestObserved: terminal.requestObserved, apiResponseObserved: false, uiTerminalFailure: true });
    fail("Evidence-guided Flow generation reached a terminal UI failure");
  }
  if (terminal.kind === "high_token_confirmation") {
    const aggregateAuthorizedTokens = EVIDENCE_GUIDED_CREATION_LIMITS.maxTotalTokens * EVIDENCE_GUIDED_CREATION_LIMITS.maxCalls;
    await evidence.diagnostic("panel", "exploration-high-token-confirmation", "exploration.high-token-confirmation-required", {
      apiRequestObserved: terminal.requestObserved,
      aggregateAuthorizedTokens,
      confirmationThreshold: LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD,
      configuredProfileRequiresConfirmation: aggregateAuthorizedTokens > LLM_HIGH_TOKEN_CONFIRMATION_THRESHOLD,
      confirmationAttempted: false,
    });
    fail("Evidence-guided Flow generation requires explicit high-token confirmation; the automated checkpoint did not confirm it");
  }
  if (terminal.kind === "timeout") {
    await evidence.diagnostic("panel", "exploration-terminal-timeout", "exploration.terminal-timeout", { apiResponseObserved: false, uiTerminalFailure: false });
    fail("Evidence-guided Flow generation did not reach a bounded terminal state");
  }
  let generationBody: unknown;
  if (terminal.kind === "response") {
    try { generationBody = await terminal.response.json(); } catch { /* sanitized failure parsing below */ }
  }
  if (terminal.kind === "response" && (!terminal.response.ok() || !generationBody || typeof generationBody !== "object" || Array.isArray(generationBody) || (generationBody as Record<string, unknown>).ok !== true)) {
    const failure = await readSanitizedGenerationFailure(terminal.response);
    for (const [index, step] of (failure.evidenceSteps ?? []).entries()) {
      await evidence.diagnostic("panel", "exploration-tool-result", `${step.toolId}.${step.resultCode ?? "outcome_unknown"}`, {
        sequence: index + 1,
        effectAppliedKnown: step.effectApplied !== undefined,
        effectApplied: step.effectApplied === true,
      });
    }
    await evidence.diagnostic("panel", "exploration-generation-rejected", failure.reasonCode ?? failure.code, {
      httpStatus: failure.status,
      providerCallCount: failure.providerCallCount,
      responseParsed: failure.parsed,
      ...(failure.evidenceLoop ? { evidenceIterationCount: failure.evidenceLoop.iterationCount, evidenceDecisionCount: failure.evidenceLoop.decisionCount, evidenceToolCallCount: failure.evidenceLoop.toolCallCount, evidenceBytes: failure.evidenceLoop.evidenceBytes } : {}),
      ...(failure.evidenceSteps ? {
        evidenceTraceStepCount: failure.evidenceSteps.length,
        evidenceEffectAppliedCount: failure.evidenceSteps.filter(step => step.effectApplied === true).length,
        evidenceEffectNotAppliedCount: failure.evidenceSteps.filter(step => step.effectApplied === false).length,
        evidenceResultCodeCount: failure.evidenceSteps.filter(step => step.resultCode !== undefined).length,
      } : {}),
    });
    fail(`Evidence-guided Flow generation failed (${failure.code})`);
  }
  const proposed = await control.listFlowAdaptations(projectId, flowId, "proposed");
  if (proposed.length !== 1 || terminal.kind === "proposal" && proposed[0]?.adaptationId !== terminal.adaptationId) fail("Exploration did not persist exactly one scoped proposal");
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
  if (inputTokens + outputTokens !== totalTokens || totalTokens > EVIDENCE_GUIDED_CREATION_LIMITS.maxTotalTokens * EVIDENCE_GUIDED_CREATION_LIMITS.maxCalls || estimatedCostUsd > EVIDENCE_GUIDED_CREATION_LIMITS.maxTotalEstimatedCostUsd) fail("Evidence-guided accounting exceeded its aggregate bounds");
  if (text(accounting.provider) !== "deepseek" || text(accounting.model) !== "deepseek-chat") fail("Evidence-guided proposal used an unexpected provider or model");
  return Object.freeze({ adaptationId: identifier(value.adaptationId), status: "proposed" as const, provider: "deepseek" as const, model: "deepseek-chat" as const, inputTokens, outputTokens, totalTokens, estimatedCostUsd });
}

export async function readProviderFreeGenerationReadiness(
  response: { ok(): boolean; status(): number; text(): Promise<string> }
): Promise<ProviderFreeGenerationReadiness> {
  const status = response.status();
  let body = "";
  try { body = await response.text(); } catch { /* incompatible without retaining error text */ }
  const responseBytes = Math.min(Buffer.byteLength(body, "utf8"), 1_000_000);
  if (!response.ok() || status < 200 || status > 299) return unreadiness(status, responseBytes, "readiness.http-rejected");
  if (!body || responseBytes > 4096) return unreadiness(status, responseBytes, "readiness.response-invalid");
  try {
    const root = JSON.parse(body) as unknown;
    const parsed = hasExactEnvelope(root, ["ok", "payload"])
      && root.ok === true
      && hasExactEnvelope(root.payload, ["readiness"])
      ? parseAutomationStudioFlowBootstrapGenerationReadiness(root.payload.readiness)
      : null;
    if (!parsed || !matchesExactJson(
      { ...parsed, supported: true, runtime: AUTOMATION_STUDIO_FLOW_BOOTSTRAP_GENERATION_READINESS.runtime },
      AUTOMATION_STUDIO_FLOW_BOOTSTRAP_GENERATION_READINESS
    )) return unreadiness(status, responseBytes, "readiness.response-invalid");
    const compatible = parsed.supported === true
      && parsed.runtime.llmExecutionGrantsConfigured === true
      && parsed.runtime.providerResolverConfigured === true
      && parsed.runtime.nativeNodeRegistryConfigured === true;
    return Object.freeze({
      compatible,
      status,
      responseBytes,
      parsed: true,
      code: compatible ? "readiness.ready" as const : "readiness.runtime-unavailable" as const,
      supported: parsed.supported,
      llmExecutionGrantsConfigured: parsed.runtime.llmExecutionGrantsConfigured,
      providerResolverConfigured: parsed.runtime.providerResolverConfigured,
      nativeNodeRegistryConfigured: parsed.runtime.nativeNodeRegistryConfigured,
    });
  } catch {
    return unreadiness(status, responseBytes, "readiness.response-invalid");
  }
}

function unreadiness(status: number, responseBytes: number, code: "readiness.http-rejected" | "readiness.response-invalid"): ProviderFreeGenerationReadiness {
  return Object.freeze({ compatible: false, status, responseBytes, parsed: false, code, supported: false, llmExecutionGrantsConfigured: false, providerResolverConfigured: false, nativeNodeRegistryConfigured: false });
}
function matchesExactJson(value: unknown, expected: unknown): boolean {
  if (value === expected) return true;
  if (Array.isArray(expected)) return Array.isArray(value)
    && value.length === expected.length
    && expected.every((item, index) => matchesExactJson(value[index], item));
  if (!expected || typeof expected !== "object" || !value || typeof value !== "object" || Array.isArray(value)) return false;
  const expectedRecord = expected as Record<string, unknown>;
  const valueRecord = value as Record<string, unknown>;
  const keys = Object.keys(expectedRecord);
  return Object.keys(valueRecord).length === keys.length
    && keys.every(key => Object.prototype.hasOwnProperty.call(valueRecord, key) && matchesExactJson(valueRecord[key], expectedRecord[key]));
}
export async function readSanitizedGenerationFailure(response: Pick<Response, "status" | "headers" | "text">): Promise<SanitizedGenerationFailure> {
  const status = response.status();
  let body = "";
  try { body = await response.text(); } catch { /* fail closed without response content */ }
  const responseBytes = Math.min(Buffer.byteLength(body, "utf8"), 1_000_000);
  if (!body || responseBytes > 4096) return sanitizedGenerationFailure(status, responseBytes, false);
  try {
    const root = JSON.parse(body) as unknown;
    if (!hasExactEnvelope(root, ["ok", "error", "payload"])) return sanitizedGenerationFailure(status, responseBytes, false);
    if (root.ok !== false || !hasExactEnvelope(root.payload, ["diagnostic"])) return sanitizedGenerationFailure(status, responseBytes, false);
    const diagnostic = parseAutomationStudioFlowBootstrapFailureDiagnostic(root.payload.diagnostic);
    const exactError = diagnostic?.code === "flow_bootstrap.unsupported_request_field"
      ? "Flow bootstrap generation request contains unsupported fields."
      : diagnostic ? `Flow Bootstrap generation failed (${diagnostic.code}).` : "";
    if (!diagnostic || root.error !== exactError) {
      return sanitizedGenerationFailure(status, responseBytes, false);
    }
    return Object.freeze({
      status,
      code: generationFailureCodeForStage(diagnostic.stage),
      reasonCode: allowlistedGenerationFailureReason(diagnostic.stage, diagnostic.code),
      responseBytes,
      parsed: true,
      providerCallKnown: true,
      providerCallCount: diagnostic.providerInvocation === "attempted" ? 1 : 0,
      accountingKnown: true,
      accountingAvailable: diagnostic.accounting !== undefined,
      ...(diagnostic.evidenceLoop ? { evidenceLoop: Object.freeze({ iterationCount: diagnostic.evidenceLoop.iterationCount, decisionCount: diagnostic.evidenceLoop.decisionCount, toolCallCount: diagnostic.evidenceLoop.toolCallCount, evidenceBytes: diagnostic.evidenceLoop.evidenceBytes }) } : {}),
      ...(diagnostic.evidenceLoop?.steps ? { evidenceSteps: sanitizeEvidenceSteps(diagnostic.evidenceLoop.steps) } : {}),
      ...(diagnostic.accounting ? {
        estimatedInputTokens: diagnostic.accounting.estimatedInputTokens,
        ...(diagnostic.accounting.inputTokens === undefined ? {} : { inputTokens: diagnostic.accounting.inputTokens }),
        ...(diagnostic.accounting.outputTokens === undefined ? {} : { outputTokens: diagnostic.accounting.outputTokens }),
        ...(diagnostic.accounting.totalTokens === undefined ? {} : { totalTokens: diagnostic.accounting.totalTokens }),
      } : {}),
    });
  } catch {
    return sanitizedGenerationFailure(status, responseBytes, false);
  }
}

function sanitizedGenerationFailure(status: number, responseBytes: number, parsed: boolean): SanitizedGenerationFailure {
  return Object.freeze({
    status,
    code: Number.isInteger(status) && status >= 100 && status <= 599 ? `generation.http-${status}` : "generation.http-unknown",
    reasonCode: null,
    responseBytes,
    parsed,
    providerCallKnown: false,
    providerCallCount: 0,
    accountingKnown: false,
    accountingAvailable: false,
  });
}

const LOCAL_FLOW_BOOTSTRAP_FAILURE_REASON_CODES = Object.freeze({
  pre_provider_validation: new Set<string>(AUTOMATION_STUDIO_FLOW_BOOTSTRAP_PHASE_FAILURE_CODES.pre_provider_validation),
  provider_resolution: new Set<string>(AUTOMATION_STUDIO_FLOW_BOOTSTRAP_PHASE_FAILURE_CODES.provider_resolution),
  provider_request: new Set<string>(AUTOMATION_STUDIO_FLOW_BOOTSTRAP_PHASE_FAILURE_CODES.provider_request),
  provider_output_validation: new Set<string>(AUTOMATION_STUDIO_FLOW_BOOTSTRAP_PHASE_FAILURE_CODES.provider_output_validation),
  post_provider_validation: new Set<string>(AUTOMATION_STUDIO_FLOW_BOOTSTRAP_PHASE_FAILURE_CODES.post_provider_validation),
  persistence: new Set<string>(AUTOMATION_STUDIO_FLOW_BOOTSTRAP_PHASE_FAILURE_CODES.persistence),
});

function allowlistedGenerationFailureReason(stage: AutomationStudioFlowBootstrapFailureStage, code: string): AutomationStudioFlowBootstrapPhaseFailureCode | null {
  return LOCAL_FLOW_BOOTSTRAP_FAILURE_REASON_CODES[stage].has(code) ? code as AutomationStudioFlowBootstrapPhaseFailureCode : null;
}
function generationFailureCodeForStage(stage: AutomationStudioFlowBootstrapFailureStage): string {
  const codes: Readonly<Record<string, string>> = Object.freeze({
    pre_provider_validation: "generation.pre-provider-validation",
    provider_resolution: "generation.provider-resolution",
    provider_request: "generation.provider-request",
    provider_output_validation: "generation.provider-output-validation",
    post_provider_validation: "generation.post-provider-validation",
    persistence: "generation.persistence",
  });
  return codes[stage] ?? "generation.http-unknown";
}
// Sanitizer allowlists. The tool ids are the three `getEvidenceTools()` offers and the result codes the two success strings plus every `WebLlmToolRejectionCode`, all in `domain/src/runtime/llm-evidence.ts`; they cannot be imported (see `reports/w3-runner-alignment.md`), so a change there is a change here.
const WEB_EVIDENCE_TOOL_IDS = new Set(["web.inspect_current_page", "web.navigate_same_origin", "web.reveal_safe"]);
const WEB_EVIDENCE_RESULT_CODES = new Set(["web.inspect.succeeded", "web.action.succeeded", ...["invalid_input", "cross_origin", "no_progress", "target_unobserved", "target_unsafe", "sensitive_value"].map(code => `web.action.rejected.${code}`)]);
function sanitizeEvidenceSteps(steps: ReadonlyArray<{ toolId: string; effectApplied?: boolean; resultCode?: string }>): NonNullable<SanitizedGenerationFailure["evidenceSteps"]> {
  return Object.freeze(steps.flatMap(step => WEB_EVIDENCE_TOOL_IDS.has(step.toolId) && (step.resultCode === undefined || WEB_EVIDENCE_RESULT_CODES.has(step.resultCode))
    ? [Object.freeze({ toolId: step.toolId, ...(step.effectApplied === undefined ? {} : { effectApplied: step.effectApplied }), ...(step.resultCode === undefined ? {} : { resultCode: step.resultCode }) })]
    : []));
}

function hasExactEnvelope(value: unknown, fields: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === fields.length && fields.every(field => Object.prototype.hasOwnProperty.call(value, field));
}
async function review(page: Page, evidence: BrowserEvidenceRecorder, pin: string, title: string, action: string, step: string): Promise<Response> {
  const button = page.getByRole("button", { name: action, exact: true });
  await exactVisible(button, `the ${action} Adaptation action`, 30_000);
  await evidence.step("panel", step + "-open", `Open ${title}`, () => button.click());
  const dialog = page.getByRole("dialog", { name: title, exact: true });
  await exactVisible(dialog, `the ${title} dialog`);
  const pinField = dialog.locator('label.field').filter({ hasText: /^PIN(?:\s|$)/u }).locator(":scope > input");
  await exactVisible(pinField, `the ${title} PIN field`);
  await evidence.step("panel", step + "-pin", `Authorize ${action}`, () => pinField.fill(pin), { sensitive: true });
  const response = await evidence.step("panel", step + "-submit", action, () => waitForEndpoint(page, "review-flow-adaptation", () => dialog.getByRole("button", { name: action, exact: true }).click()), { sensitive: true });
  await dialog.waitFor({ state: "hidden", timeout: 30_000 });
  if (!response.ok()) fail(`${action} Adaptation request failed`);
  return response;
}

export function parseAppliedExecutionDigest(body: unknown, ok: boolean, expectedBaseDigest: string): string {
  const root = record(body); if (!ok || root.ok !== true) fail("Adaptation apply response failed");
  const adaptation = record(record(root.payload).adaptation);
  const metadata = record(adaptation.metadata);
  if (metadata.adaptationKind !== "flow_bootstrap") fail("Adaptation apply response was not a Flow bootstrap");
  const bootstrap = record(metadata.bootstrap);
  const application = record(bootstrap.application);
  const baseSettingsRevision = integer(bootstrap.baseSettingsRevision);
  const currentSettingsRevision = integer(bootstrap.currentSettingsRevision);
  if (currentSettingsRevision <= baseSettingsRevision) fail("Adaptation apply response did not advance the Core settings revision");
  const base = identifier(bootstrap.baseExecutionDigest);
  const current = identifier(bootstrap.currentExecutionDigest);
  const applied = identifier(application.appliedExecutionDigest);
  if (base !== expectedBaseDigest || current !== applied || applied === base) fail("Adaptation apply response did not prove an exact changed canonical Core execution binding");
  return applied;
}
async function setSelect(root: Locator, label: string, value: string, page: Page, evidence: BrowserEvidenceRecorder): Promise<void> {
  const field = root.getByLabel(label, { exact: true });
  await exactVisible(field, `the exact ${label} setting`);
  if (await field.inputValue() !== value) await evidence.step("panel", `create-settings-${slug(label)}`, `Set ${label}`, () => field.selectOption(value));
}

async function waitForEndpoint(page: Page, endpoint: string, dispatch: () => Promise<void>, timeout = 60_000): Promise<Response> {
  const response = page.waitForResponse(candidate => candidate.request().method() === "POST" && candidate.url().includes(`/api/programs/automation-studio/${endpoint}`), { timeout });
  await dispatch();
  return response;
}

type ExplorationTerminal = { kind: "response"; response: Response } | { kind: "proposal"; adaptationId: string } | ExplorationUiTerminal | { kind: "timeout" };
export type ExplorationUiTerminal = { kind: "high_token_confirmation" | "ui_failure"; requestObserved: boolean };
export function classifyExplorationUiTerminal(input: { highTokenConfirmationVisible: boolean; alertVisible: boolean; requestObserved: boolean }): ExplorationUiTerminal | undefined {
  if (input.highTokenConfirmationVisible) return { kind: "high_token_confirmation", requestObserved: input.requestObserved };
  if (input.alertVisible) return { kind: "ui_failure", requestObserved: input.requestObserved };
  return undefined;
}
async function waitForExplorationTerminal(page: Page, authoring: Locator, control: Pick<ExistingFluxIQControlClient, "listFlowAdaptations">, projectId: string, flowId: string, dispatch: () => Promise<void>): Promise<ExplorationTerminal> {
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
        highTokenConfirmationVisible: await page.getByRole("dialog", { name: "Confirm high-token Flow Build", exact: true }).isVisible().catch(() => false),
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

async function exactVisible(locator: Locator, label: string, timeout = 10_000): Promise<void> {
  await locator.first().waitFor({ state: "visible", timeout });
  if (await locator.count() !== 1) fail(`${label} is unavailable or ambiguous`);
}
export async function exactVirtualizedHierarchyObject(page: Page, hierarchy: Locator, itemId: string, label: string, rowSelector = ".tree-row-main.type-flow-object"): Promise<Locator> {
  const viewport = hierarchy.locator(".automation-project-tree");
  await exactVisible(viewport, "the project hierarchy viewport");
  const item = hierarchy.locator(`.automation-tree-item[data-tree-item-id="${escapeCss(itemId)}"]`);
  const deadline = Date.now() + 10_000;
  let offset = 0;
  while (Date.now() < deadline) {
    if (await item.count() === 1 && await item.isVisible().catch(() => false)) return item.locator(rowSelector);
    const metrics = await viewport.evaluate((element) => ({ height: element.clientHeight, maximum: Math.max(0, element.scrollHeight - element.clientHeight) }));
    offset = Math.min(metrics.maximum, offset + Math.max(36, metrics.height - 36));
    await viewport.evaluate((element, next) => { element.scrollTop = next; }, offset);
    await page.waitForTimeout(75);
  }
  fail(`${label} is unavailable in the virtualized hierarchy`);
}
function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) fail("Flow bootstrap response was malformed"); return value as Record<string, unknown>; }
function text(value: unknown): string { if (typeof value !== "string" || !value.trim()) fail("Flow bootstrap response omitted a required string"); return value; }
function identifier(value: unknown): string { const result = text(value); if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u.test(result)) fail("Flow bootstrap response contained an invalid identifier"); return result; }
function integer(value: unknown): number { if (!Number.isSafeInteger(value) || (value as number) < 0) fail("Flow bootstrap response omitted finite provider token accounting"); return value as number; }
function finite(value: unknown): number { if (typeof value !== "number" || !Number.isFinite(value) || value < 0) fail("Flow bootstrap response omitted finite provider cost accounting"); return value; }
function slug(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, ""); }
function escapeCss(value: string): string { return value.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"'); }
function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"); }
function fail(message: string): never { throw new RunnerFailure("runtime.behavior", message); }
function inspectionFail(message: string, reasonCode: string): never { throw new RunnerFailure("runtime.behavior", message, { details: { reasonCode } }); }
