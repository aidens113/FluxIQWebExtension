import { createHash } from "node:crypto";
import { randomBytes } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { EVIDENCE_GUIDED_CREATION_LIMITS } from "./demo-llm-create-ui.js";
import { BLANK_LLM_INSTRUCTION_BODY } from "./demo-llm-blank-workspace.js";
import { hardenWindowsPrivatePath } from "./windows-acl.js";
import { loadScenarioManifest } from "./scenarios.js";
import type { WebScenario } from "@fluxiq-web-extension/test-contracts";

export const DEMO_LLM_EXPLORATION_SCENARIO_ENV = "FLUXIQ_LLM_SCENARIO_ID" as const;
export const DEMO_LLM_EXPLORATION_INSTRUCTION_ENV = "FLUXIQ_LLM_INSTRUCTION" as const;
export const DEFAULT_DEMO_LLM_EXPLORATION_SCENARIO_ID = "instruction-only-form" as const;
const MAX_INSTRUCTION_CHARACTERS = 4_000;
const SCENARIO_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u;
const UNSAFE_TEXT_CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const REQUEST_BINDING_SCHEMA_VERSION = "0.1" as const;

export type DemoLlmExplorationRequest = Readonly<{
  scenarioId: string;
  scenarioPath: string;
  instruction: string;
}>;

export type DemoLlmExplorationRequestReadiness = Readonly<{
  status: "ready";
  providerCallCount: 0;
  scenarioId: string;
  scenarioPath: string;
  instructionCharacters: number;
  instructionBytes: number;
  instructionDigest: string;
  exactOriginRequired: true;
  recorderRequiredIdle: true;
  manualReviewRequired: true;
  providerBudget: Readonly<{
    provider: "deepseek";
    model: "deepseek-chat";
    maxInputTokens: number;
    maxOutputTokens: number;
    maxTotalTokens: number;
    maxCalls: number;
    timeoutSeconds: number;
    maxEstimatedCostUsd: number;
    maxTotalEstimatedCostUsd: number;
    providerRetries: number;
  }>;
}>;

export type DemoLlmExplorationRequestBinding = Readonly<{
  schemaVersion: typeof REQUEST_BINDING_SCHEMA_VERSION;
  scenarioId: string;
  scenarioPath: string;
  instructionDigest: string;
  projectId: string;
  flowId: string;
  adaptationId: string;
}>;

export type BoundExplorationRunValidation = Readonly<{
  runId: string;
  actionAttemptCount: number;
  succeededActionCount: number;
  routedOwnedSubflow: true;
  recordingCount: number;
}>;

export async function resolveDemoLlmExplorationRequest(repositoryRoot: string, env: NodeJS.ProcessEnv): Promise<DemoLlmExplorationRequest> {
  const scenarioId = boundedScenarioId(env[DEMO_LLM_EXPLORATION_SCENARIO_ENV] ?? DEFAULT_DEMO_LLM_EXPLORATION_SCENARIO_ID);
  const instruction = boundedInstruction(env[DEMO_LLM_EXPLORATION_INSTRUCTION_ENV] ?? BLANK_LLM_INSTRUCTION_BODY);
  const scenario = await loadScenarioManifest(repositoryRoot, scenarioId);
  return Object.freeze({ scenarioId, scenarioPath: manifestScenarioPath(scenario), instruction });
}

/** Content-free provider-free projection suitable for CLI output and retained test evidence. */
export function inspectDemoLlmExplorationRequestReadiness(request: DemoLlmExplorationRequest): DemoLlmExplorationRequestReadiness {
  const scenarioId = boundedScenarioId(request.scenarioId);
  const scenarioPath = boundedScenarioPath(request.scenarioPath, scenarioId);
  const instruction = boundedInstruction(request.instruction);
  const instructionBytes = Buffer.byteLength(instruction, "utf8");
  return Object.freeze({
    status: "ready",
    providerCallCount: 0,
    scenarioId,
    scenarioPath,
    instructionCharacters: instruction.length,
    instructionBytes,
    instructionDigest: createHash("sha256").update(instruction, "utf8").digest("hex"),
    exactOriginRequired: true,
    recorderRequiredIdle: true,
    manualReviewRequired: true,
    providerBudget: Object.freeze({
      provider: EVIDENCE_GUIDED_CREATION_LIMITS.provider,
      model: EVIDENCE_GUIDED_CREATION_LIMITS.model,
      maxInputTokens: EVIDENCE_GUIDED_CREATION_LIMITS.maxInputTokens,
      maxOutputTokens: EVIDENCE_GUIDED_CREATION_LIMITS.maxOutputTokens,
      maxTotalTokens: EVIDENCE_GUIDED_CREATION_LIMITS.maxTotalTokens,
      maxCalls: EVIDENCE_GUIDED_CREATION_LIMITS.maxCalls,
      timeoutSeconds: EVIDENCE_GUIDED_CREATION_LIMITS.timeoutSeconds,
      maxEstimatedCostUsd: EVIDENCE_GUIDED_CREATION_LIMITS.maxEstimatedCostUsd,
      maxTotalEstimatedCostUsd: EVIDENCE_GUIDED_CREATION_LIMITS.maxTotalEstimatedCostUsd,
      providerRetries: EVIDENCE_GUIDED_CREATION_LIMITS.providerRetries,
    }),
  });
}

export function createDemoLlmExplorationRequestBinding(request: DemoLlmExplorationRequest, identity: Readonly<{ projectId: string; flowId: string; adaptationId: string }>): DemoLlmExplorationRequestBinding {
  const readiness = inspectDemoLlmExplorationRequestReadiness(request);
  return Object.freeze({
    schemaVersion: REQUEST_BINDING_SCHEMA_VERSION,
    scenarioId: readiness.scenarioId,
    scenarioPath: readiness.scenarioPath,
    instructionDigest: readiness.instructionDigest,
    projectId: boundedIdentity(identity.projectId, "projectId"),
    flowId: boundedIdentity(identity.flowId, "flowId"),
    adaptationId: boundedIdentity(identity.adaptationId, "adaptationId"),
  });
}

export function parseDemoLlmExplorationRequestBinding(input: unknown): DemoLlmExplorationRequestBinding {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Exploration request binding must be an object");
  const value = input as Record<string, unknown>;
  const allowed = ["schemaVersion", "scenarioId", "scenarioPath", "instructionDigest", "projectId", "flowId", "adaptationId"];
  if (value.schemaVersion !== REQUEST_BINDING_SCHEMA_VERSION || Object.keys(value).some(key => !allowed.includes(key))) throw new Error("Exploration request binding has an unsupported schema");
  const scenarioId = boundedScenarioId(value.scenarioId);
  const scenarioPath = boundedScenarioPath(value.scenarioPath, scenarioId);
  if (typeof value.instructionDigest !== "string" || !/^[a-f0-9]{64}$/u.test(value.instructionDigest)) throw new Error("Exploration request binding instruction digest is invalid");
  return Object.freeze({
    schemaVersion: REQUEST_BINDING_SCHEMA_VERSION,
    scenarioId,
    scenarioPath,
    instructionDigest: value.instructionDigest,
    projectId: boundedIdentity(value.projectId, "projectId"),
    flowId: boundedIdentity(value.flowId, "flowId"),
    adaptationId: boundedIdentity(value.adaptationId, "adaptationId"),
  });
}

export function assertDemoLlmExplorationBindingScenario(binding: DemoLlmExplorationRequestBinding, scenario: WebScenario): void {
  if (binding.scenarioId !== scenario.id || binding.scenarioPath !== manifestScenarioPath(scenario)) {
    throw new Error("Exploration request binding no longer matches the registered scenario path");
  }
}

export async function loadDemoLlmExplorationRequestBinding(workspaceDirectory: string): Promise<DemoLlmExplorationRequestBinding | undefined> {
  try { return parseDemoLlmExplorationRequestBinding(JSON.parse(await readFile(requestBindingPath(workspaceDirectory), "utf8"))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
}

export async function saveDemoLlmExplorationRequestBinding(workspaceDirectory: string, binding: DemoLlmExplorationRequestBinding, secretLiterals: readonly string[]): Promise<void> {
  const checked = parseDemoLlmExplorationRequestBinding(binding);
  const serialized = JSON.stringify(checked, null, 2) + "\n";
  if (secretLiterals.some(secret => secret && serialized.includes(secret))) throw new Error("Exploration request binding contains credential material");
  const target = requestBindingPath(workspaceDirectory);
  const temporary = `${target}.${randomBytes(6).toString("hex")}.tmp`;
  await writeFile(temporary, serialized, { encoding: "utf8", flag: "wx", mode: 0o600 });
  await rename(temporary, target);
  if (process.platform === "win32") await hardenWindowsPrivatePath(target, "file");
}

export function validateBoundExplorationRun(input: Readonly<{
  runId: string;
  dispatchStatus: string;
  detailStatus: string;
  providerCallCount?: number;
  interventionCount: number;
  actionStatuses: readonly string[];
  selectedSubflowIds: readonly (string | undefined)[];
  subflows: readonly Readonly<{ subflowId: string; status: string; graphFlowId?: string }>[];
  ownedSubflowId: string;
  graphFlowId: string;
  recordingIdsBefore: readonly string[];
  recordingIdsAfter: readonly string[];
}>): BoundExplorationRunValidation {
  const runId = boundedIdentity(input.runId, "runId");
  if (input.dispatchStatus !== "succeeded" || input.detailStatus !== "succeeded"
    || input.actionStatuses.some(status => status !== "succeeded")
    || (input.providerCallCount ?? 0) !== 0 || input.interventionCount !== 0) {
    throw new Error("Bound exploration Flow did not complete deterministically without LLM intervention");
  }
  const ownedSubflowId = boundedIdentity(input.ownedSubflowId, "ownedSubflowId");
  const graphFlowId = boundedIdentity(input.graphFlowId, "graphFlowId");
  if (!input.selectedSubflowIds.includes(ownedSubflowId)
    || !input.subflows.some(entry => entry.subflowId === ownedSubflowId && entry.status === "succeeded" && entry.graphFlowId === graphFlowId)) {
    throw new Error("Bound exploration Flow did not route through its owned Subflow graph");
  }
  const before = new Set(input.recordingIdsBefore.map(value => boundedIdentity(value, "recordingId")));
  const after = new Set(input.recordingIdsAfter.map(value => boundedIdentity(value, "recordingId")));
  if (before.size !== after.size || [...before].some(value => !after.has(value))) throw new Error("Bound exploration Flow changed project recordings");
  return Object.freeze({
    runId,
    actionAttemptCount: input.actionStatuses.length,
    succeededActionCount: input.actionStatuses.length,
    routedOwnedSubflow: true,
    recordingCount: after.size,
  });
}

function boundedScenarioId(input: unknown): string {
  if (typeof input !== "string") throw new Error("Scenario ID must be a bounded identifier");
  const value = input.trim();
  if (!SCENARIO_ID_PATTERN.test(value)) throw new Error("Scenario ID must contain 1 to 64 lowercase letters, numbers, or internal hyphens");
  return value;
}

function boundedInstruction(input: unknown): string {
  if (typeof input !== "string") throw new Error("Exploration instruction must be text");
  const value = input.trim();
  if (!value || value.length > MAX_INSTRUCTION_CHARACTERS || UNSAFE_TEXT_CONTROL_PATTERN.test(value)) {
    throw new Error("Exploration instruction must contain 1 to 4,000 safe text characters");
  }
  return value;
}

function manifestScenarioPath(scenario: WebScenario): string {
  if (boundedScenarioId(scenario.id) !== scenario.id) throw new Error("Registered scenario ID is not valid for LLM exploration");
  return boundedScenarioPath(scenario.startPath, scenario.id);
}

function boundedScenarioPath(input: unknown, scenarioId: string): string {
  if (typeof input !== "string" || input.length > 500 || input.includes("?") || input.includes("#") || input.includes("\\")) throw new Error("Exploration scenario path is invalid");
  const requiredPrefix = `/scenarios/${scenarioId}`;
  if (input !== requiredPrefix && input !== `${requiredPrefix}/` && !input.startsWith(`${requiredPrefix}/`)) throw new Error("Exploration scenario path does not match its bounded scenario ID");
  const parsed = new URL(input, "http://127.0.0.1");
  if (parsed.origin !== "http://127.0.0.1" || parsed.pathname !== input || parsed.username || parsed.password) throw new Error("Exploration scenario path is invalid");
  return input;
}

function boundedIdentity(input: unknown, name: string): string {
  if (typeof input !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u.test(input)) throw new Error(`Exploration request binding ${name} is invalid`);
  return input;
}

function requestBindingPath(workspaceDirectory: string): string { return path.join(workspaceDirectory, "llm-exploration-request-binding.json"); }
