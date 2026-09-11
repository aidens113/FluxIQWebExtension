// The persisted identity of a prepared deterministic-diagnosis workspace, and
// the checks that keep credential material out of it and confirm the prepared
// Flow still matches what was saved.
import { randomBytes } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { ExistingFluxIQControlClient } from "../existing-fluxiq-control.js";
import { RunnerFailure } from "../failure.js";
import { hardenWindowsPrivatePath } from "../windows-acl.js";
import type { DemoWorkspaceConfiguration } from "./configuration.js";
import { recordingIds } from "./control-waits.js";
import { LLM_DIAGNOSIS_FLOW_NAME, LLM_DIAGNOSIS_SUBFLOW_NAME } from "./diagnosis-ui.js";
import { assertDemoParentDocument, assertDemoSubflowOwnership, assertLlmDiagnosisRecordingDerivedFlow } from "./flow-document.js";
import { type DemoWorkspaceState, SCHEMA_VERSION } from "./workspace-state.js";

export const LLM_PREPARATION_SCHEMA_VERSION = "0.1" as const;

export type DemoLlmPreparationState = {
  schemaVersion: typeof LLM_PREPARATION_SCHEMA_VERSION;
  projectId: string;
  flowId: string;
  subflowId: string;
  graphFlowId: string;
  routerId: string;
  recordingId: string;
};

export function llmPreparationStatePath(config: DemoWorkspaceConfiguration): string {
  return path.join(config.workspaceDirectory, "llm-diagnosis-workspace.json");
}

export function parseDemoLlmPreparationState(value: unknown): DemoLlmPreparationState {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("LLM diagnosis preparation state must be an object");
  const record = value as Record<string, unknown>;
  const allowed = ["schemaVersion", "projectId", "flowId", "subflowId", "graphFlowId", "routerId", "recordingId"];
  if (record.schemaVersion !== LLM_PREPARATION_SCHEMA_VERSION || Object.keys(record).some(key => !allowed.includes(key))) throw new Error("LLM diagnosis preparation state has an unsupported schema");
  for (const field of allowed.slice(1)) {
    if (typeof record[field] !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u.test(record[field] as string)) throw new Error(`LLM diagnosis preparation state is missing or has an invalid ${field}`);
  }
  return record as DemoLlmPreparationState;
}

export function assertDemoLlmPreparationStateDoesNotContainSecrets(state: DemoLlmPreparationState, secrets: readonly string[]): void {
  const serialized = JSON.stringify(state);
  if (secrets.some(secret => secret.length > 0 && serialized.includes(secret))) throw new Error("LLM diagnosis preparation metadata contains credential material");
}

export async function loadLlmPreparationState(config: DemoWorkspaceConfiguration): Promise<DemoLlmPreparationState | undefined> {
  try { return parseDemoLlmPreparationState(JSON.parse(await readFile(llmPreparationStatePath(config), "utf8"))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
}

export async function saveLlmPreparationState(config: DemoWorkspaceConfiguration, state: DemoLlmPreparationState, secrets: readonly string[]): Promise<void> {
  assertDemoLlmPreparationStateDoesNotContainSecrets(state, secrets);
  const target = llmPreparationStatePath(config);
  const temporary = target + "." + randomBytes(6).toString("hex") + ".tmp";
  await writeFile(temporary, JSON.stringify(state, null, 2) + "\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
  await rename(temporary, target);
  if (process.platform === "win32") await hardenWindowsPrivatePath(target, "file");
}

export function preparationIdentity(state: DemoWorkspaceState, recordingId: string): DemoLlmPreparationState {
  return { schemaVersion: LLM_PREPARATION_SCHEMA_VERSION, projectId: state.projectId, flowId: state.flowId, subflowId: state.subflowId, graphFlowId: state.graphFlowId, routerId: state.routerId, recordingId };
}

export async function requirePreparedLlmDiagnosis(control: ExistingFluxIQControlClient, config: DemoWorkspaceConfiguration, identity: DemoLlmPreparationState): Promise<DemoWorkspaceState> {
  const project = await control.requireProject(identity.projectId, "web-automation");
  const state: DemoWorkspaceState = { schemaVersion: SCHEMA_VERSION, origin: config.origin, username: config.username, projectId: identity.projectId, flowId: identity.flowId, subflowId: identity.subflowId, graphFlowId: identity.graphFlowId, routerId: identity.routerId, projectName: project.name, flowName: LLM_DIAGNOSIS_FLOW_NAME, latestRecordingId: identity.recordingId, updatedAt: new Date().toISOString() };
  await assertPreparedDiagnosisGraph(control, state, identity.recordingId);
  await control.selectExistingContext(identity.projectId);
  return state;
}

export async function assertPreparedDiagnosisGraph(control: ExistingFluxIQControlClient, state: DemoWorkspaceState, recordingId: string): Promise<void> {
  const parent = await control.getExactFlow(state.projectId, state.flowId);
  assertDemoParentDocument(parent.document, state.projectId, state.flowId, LLM_DIAGNOSIS_FLOW_NAME);
  const subflow = (await control.listFlowSubflows(state.projectId, state.flowId)).find(item => item.subflowId === state.subflowId);
  if (!subflow || subflow.name !== LLM_DIAGNOSIS_SUBFLOW_NAME || subflow.graphFlowId !== state.graphFlowId) throw new RunnerFailure("environment.missing", "Saved LLM diagnosis Subflow identity no longer matches Core");
  const graph = await control.getExactFlow(state.projectId, state.graphFlowId);
  assertDemoSubflowOwnership(graph.document, state.projectId, state.flowId, state.subflowId, state.graphFlowId);
  assertLlmDiagnosisRecordingDerivedFlow(graph.document, recordingId);
  const router = await control.getFlowRouter(state.projectId, state.flowId);
  if (!router || router.routerId !== state.routerId || router.fallback?.kind !== "subflow" || router.fallback.subflowId !== state.subflowId) throw new RunnerFailure("environment.missing", "Saved LLM diagnosis Router no longer targets its owned Subflow");
}

export async function existingDiagnosisRecordingId(control: ExistingFluxIQControlClient, state: DemoWorkspaceState): Promise<string | undefined> {
  const parent = await control.getExactFlow(state.projectId, state.flowId);
  const candidate = (parent.document.metadata as Record<string, unknown> | undefined)?.lastRecordingId;
  if (typeof candidate !== "string" || !candidate.trim()) return undefined;
  const recordings = recordingIds(await control.listRecordings(state.projectId));
  if (!recordings.has(candidate)) throw new RunnerFailure("environment.missing", "Diagnosis Flow references a recording that is no longer accessible");
  await assertPreparedDiagnosisGraph(control, state, candidate);
  return candidate;
}
