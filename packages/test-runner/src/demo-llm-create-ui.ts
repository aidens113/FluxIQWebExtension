import { createHash } from "node:crypto";
import type { Locator, Page, Response } from "@playwright/test";
import type { BrowserEvidenceRecorder } from "./browser-evidence.js";
import { AUTOMATION_STUDIO_ENDPOINTS, AUTOMATION_STUDIO_FLOW_BOOTSTRAP_GENERATION_READINESS, AUTOMATION_STUDIO_FLOW_BOOTSTRAP_PHASE_FAILURE_CODES, parseAutomationStudioFlowBootstrapFailureDiagnostic, parseAutomationStudioFlowBootstrapGenerationReadiness, type AutomationStudioFlowBootstrapFailureStage, type AutomationStudioFlowBootstrapPhaseFailureCode } from "fluxiq/automation-studio";
import { RunnerFailure } from "./failure.js";
import { ExistingFluxIQControlClient } from "./existing-fluxiq-control.js";
import { TESTING_LAB_DEEPSEEK_KEY_NAME } from "./secret-keys-ui.js";

export const FIRST_LIVE_CREATION_LIMITS = Object.freeze({
  provider: "deepseek", model: "deepseek-chat", maxInputTokens: 2000, maxOutputTokens: 512,
  maxTotalTokens: 3000, maxCalls: 1, timeoutSeconds: 20, maxEstimatedCostUsd: 0.25, providerRetries: 0,
});

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
}>;
const MAX_REPORTED_REVISION_DELTA = 1_000_000;
export async function configureFirstLiveCreationViaUi(page: Page, flowTreeItemId: string, pin: string, evidence: BrowserEvidenceRecorder): Promise<void> {
  const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
  const search = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
  await evidence.step("panel", "create-settings-search", "Search this Flow for Settings", () => search.fill("Settings"));
  const rows = hierarchy.locator(`.automation-tree-item[data-tree-parent-id="${escapeCss(flowTreeItemId)}"][aria-label="Settings"] .tree-row-main.type-flow-object`);
  await exactVisible(rows, "the exact Flow Settings row");
  await evidence.step("panel", "create-settings-open", "Open this Flow's Settings", () => rows.click());
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
  const fields = [["Input tokens", "2000"], ["Output tokens", "512"], ["Total tokens", "3000"], ["Max calls", "1"], ["Timeout (seconds)", "20"], ["Max cost (USD)", "0.25"], ["Provider retries", "0"]] as const;
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
  page: Page; flowTreeItemId: string; projectId: string; flowId: string; password: string; pin: string;
  evidence: BrowserEvidenceRecorder; control: ExistingFluxIQControlClient; blankContentHash: string;
};
type BuildApproveApplyCreationResult = { generation: LiveCreationGeneration; topology: LiveCreationTopology };

export async function buildApproveApplyCreationViaUi(input: BuildApproveApplyCreationInput): Promise<BuildApproveApplyCreationResult> {
  await assertProviderFreeGenerationReadiness(input.page, input.evidence);
  await input.evidence.diagnostic("panel", "generation-readiness", "generation-readiness.v1", { compatible: true });
  return buildApproveApplyCreationAfterReadiness(input);
}

async function buildApproveApplyCreationAfterReadiness(input: BuildApproveApplyCreationInput): Promise<BuildApproveApplyCreationResult> {
  const { page, flowTreeItemId, projectId, flowId, password, pin, evidence, control, blankContentHash } = input;
  const hierarchy = page.getByRole("complementary", { name: "Project hierarchy" });
  const search = hierarchy.getByRole("searchbox", { name: "Search project hierarchy" });
  await evidence.step("panel", "create-runtime-search", "Search this Flow for Runtime Debug", () => search.fill("Runtime Debug"));
  const rows = hierarchy.locator(`.automation-tree-item[data-tree-parent-id="${escapeCss(flowTreeItemId)}"][aria-label="Runtime Debug"] .tree-row-main.type-flow-object`);
  await exactVisible(rows, "the exact Flow Runtime Debug row");
  await evidence.step("panel", "create-runtime-open", "Open Runtime Debug for this Flow", () => rows.click());
  await evidence.step("panel", "create-runtime-search-clear", "Clear hierarchy search", () => search.fill(""));
  const authoring = page.getByRole("region", { name: "Build Flow from instructions", exact: true });
  await exactVisible(authoring, "the provider-ready Build Flow from instructions region", 30_000);
  const build = authoring.getByRole("button", { name: "Build Flow from instructions", exact: true });
  await exactVisible(build, "the unambiguous Build Flow from instructions action");
  await evidence.step("panel", "create-build-open", "Open one-call Flow Build authorization", () => build.click());
  const dialog = page.getByRole("dialog", { name: "Authorize Flow Build", exact: true });
  await exactVisible(dialog, "the Flow Build authorization dialog");
  await assertLimits(dialog.getByRole("definition"));
  const passwordField = dialog.getByLabel("Account password", { exact: true });
  const pinField = dialog.getByLabel("Security PIN", { exact: true });
  await exactVisible(passwordField, "the Flow Build password field");
  await exactVisible(pinField, "the Flow Build PIN field");
  await evidence.step("panel", "create-build-password", "Enter account authorization", () => passwordField.fill(password), { sensitive: true });
  await evidence.step("panel", "create-build-pin", "Enter Flow Build PIN", () => pinField.fill(pin), { sensitive: true });
  const started = Date.now();
  const response = await evidence.step("panel", "create-build-authorize", "Authorize exactly one bounded Flow bootstrap call", () => waitForEndpoint(page, "generate-flow-bootstrap-adaptation", () => dialog.getByRole("button", { name: "Authorize One Build", exact: true }).click()), { sensitive: true });
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
    });
    fail(`Bounded Flow bootstrap generation failed (${failure.code})`);
  }
  const adaptation = parseGeneration(await response.json(), true, projectId, flowId, latencyMs);
  await page.getByText("Adaptations", { exact: true }).first().waitFor({ timeout: 30_000 });
  await page.getByText("Adaptation Detail", { exact: true }).waitFor({ timeout: 30_000 });
  await page.getByText(adaptation.adaptationId, { exact: true }).waitFor({ timeout: 30_000 });
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
  if (subflows.length !== 1 || !subflows[0]!.graphFlowId) fail("Applied creation must own exactly one graph-backed Subflow");
  const owned = subflows[0]!;
  const graphFlowId = owned.graphFlowId;
  if (!graphFlowId) fail("Applied creation Subflow omitted its graph Flow identity");
  const router = await control.getFlowRouter(projectId, flowId);
  if (!router) fail("Applied creation did not create a Router");
  const routed = [router.fallback, ...router.rules.map(rule => rule.target)].filter(target => target?.kind === "subflow" && target.subflowId === owned.subflowId);
  if (routed.length !== 1) fail("Applied creation must route exactly once to its owned Subflow");
  const graph = await control.getExactFlow(projectId, graphFlowId);
  const viewport = await control.getFlowGraphViewport(projectId, graphFlowId);
  const nodes = Array.isArray(graph.document.nodes) ? graph.document.nodes as Record<string, unknown>[] : [];
  const edges = Array.isArray(graph.document.edges) ? graph.document.edges : [];
  if (!nodes.length || edges.length < Math.max(0, nodes.length - 1) || viewport.nodeCount !== nodes.length || viewport.edgeCount !== edges.length) fail("Applied creation graph is empty, disconnected, or inconsistent");
  const definitions = new Map((await control.listNativeNodeDefinitions(projectId)).map(item => [item.id, item]));
  const executable = nodes.filter(node => typeof node.definitionId === "string" && definitions.get(node.definitionId)?.executable).length;
  if (executable !== nodes.length) fail("Applied creation contains unsupported or non-executable output nodes");
  let overlaps = 0;
  for (let i = 0; i < viewport.nodes.length; i++) for (let j = i + 1; j < viewport.nodes.length; j++) {
    const a = viewport.nodes[i]!, b = viewport.nodes[j]!;
    if (Math.abs(a.x - b.x) < 220 && Math.abs(a.y - b.y) < 96) overlaps += 1;
  }
  if (overlaps) fail("Applied creation graph positions overlap");
  const serialized = JSON.stringify([await control.getExactFlow(projectId, flowId), graph, router, subflows]);
  if (/lastRecordingId|sourceRecordingIds|recordingProvenance|recordingId/iu.test(serialized)) fail("Applied creation contains recording provenance");
  const resultingExecutionDigest = identifier(canonicalResultingDigest);
  if (resultingExecutionDigest === baseDigest) fail("Applied creation did not change the canonical Core execution digest");
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
  if (currentSettingsRevision !== baseSettingsRevision) fail("Adaptation apply response settings revision drifted during review");
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

async function assertLimits(_definitions: Locator): Promise<void> {
  // The modal itself is scoped exactly; text checks prevent a paid call if Core's fixed request policy drifts.
  const page = _definitions.page();
  const dialog = page.getByRole("dialog", { name: "Authorize Flow Build", exact: true });
  const region = dialog.getByRole("definition");
  const expected = ["2000", "512", "3000", "1", "20 seconds", "$0.25", "0"];
  const values = await region.allTextContents();
  if (values.length !== expected.length || values.some((value, index) => value.trim() !== expected[index])) fail("Flow Build authorization limits do not match the certified request profile");
}

async function waitForEndpoint(page: Page, endpoint: string, dispatch: () => Promise<void>): Promise<Response> {
  const response = page.waitForResponse(candidate => candidate.request().method() === "POST" && candidate.url().includes(`/api/programs/automation-studio/${endpoint}`), { timeout: 60_000 });
  await dispatch();
  return response;
}

function parseGeneration(body: unknown, ok: boolean, projectId: string, flowId: string, latencyMs: number): LiveCreationGeneration {
  const root = record(body); if (!ok || root.ok !== true) fail("Bounded Flow bootstrap generation failed");
  const payload = record(root.payload), value = record(payload.adaptation), accounting = record(value.accounting);
  if (text(value.projectId) !== projectId || text(value.flowId) !== flowId || value.status !== "proposed") fail("Flow bootstrap response escaped its certified scope");
  const inputTokens = integer(accounting.inputTokens), outputTokens = integer(accounting.outputTokens), totalTokens = integer(accounting.totalTokens);
  const cost = finite(accounting.estimatedCostUsd);
  if (inputTokens > 2000 || outputTokens > 512 || totalTokens > 3000 || inputTokens + outputTokens !== totalTokens || cost > 0.25) fail("Flow bootstrap provider accounting exceeded strict limits");
  if (text(accounting.provider) !== "deepseek" || text(accounting.model) !== "deepseek-chat") fail("Flow bootstrap used an unexpected provider or model");
  const safe = { adaptationId: identifier(value.adaptationId), baseExecutionDigest: identifier(value.baseDependencyDigest), requestId: identifier(accounting.requestId), provider: "deepseek" as const, model: "deepseek-chat" as const, promptSchemaVersion: "flow-bootstrap.v1", inputTokens, outputTokens, totalTokens, estimatedCostUsd: cost, latencyMs };
  return Object.freeze({ ...safe, proposalDigest: createHash("sha256").update(JSON.stringify(safe)).digest("hex") });
}

async function exactVisible(locator: Locator, label: string, timeout = 10_000): Promise<void> {
  await locator.first().waitFor({ state: "visible", timeout });
  if (await locator.count() !== 1) fail(`${label} is unavailable or ambiguous`);
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
