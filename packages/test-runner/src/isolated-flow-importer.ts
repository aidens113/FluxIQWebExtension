import { createHash } from "node:crypto";
import type { CloneIdMapping, CloneJsonObject, ClonePackage } from "@fluxiq-web-extension/test-contracts";
import { assertClonePackage } from "@fluxiq-web-extension/test-contracts";
import { attestCloneEquivalence, hashCanonicalJson, remapCloneDocument } from "./clone-policy.js";
import { RunnerFailure } from "./failure.js";
import type { FluxIQControlClient, FluxIQHttpOptions } from "./http-control.js";

type JsonRecord = Record<string, unknown>;
export type IsolatedDestinationControl = Pick<FluxIQControlClient, "createProject" | "createFlow" | "saveFlow" | "getFlow">;
export type RunOwnedCloneProject = { projectId: string; name: string };
export type IsolatedCloneImportResult = { projectId: string; flowId: string; contentHash: string; document: CloneJsonObject; idMap: readonly CloneIdMapping[]; attested: true };

export function createRunOwnedCloneFlowId(input: { runId: string; sourceProjectId: string; sourceFlowId: string; sourceContentHash: string }): string {
  requiredText(input.runId, "runId"); requiredText(input.sourceProjectId, "sourceProjectId"); requiredText(input.sourceFlowId, "sourceFlowId"); requiredDigest(input.sourceContentHash, "sourceContentHash");
  return `flow.clone.${createHash("sha256").update(`${input.runId}\0${input.sourceProjectId}\0${input.sourceFlowId}\0${input.sourceContentHash}`).digest("hex").slice(0, 24)}`;
}

/** Creates only a disposable destination project through Core's public API. */
export async function createRunOwnedCloneProject(
  control: IsolatedDestinationControl,
  input: { runId: string; sourceContentHash: string; authorizationPin: string; domainId?: string | null } & FluxIQHttpOptions,
): Promise<RunOwnedCloneProject> {
  requiredText(input.runId, "runId"); requiredDigest(input.sourceContentHash, "sourceContentHash"); requiredText(input.authorizationPin, "authorizationPin");
  const suffix = createHash("sha256").update(`${input.runId}\0${input.sourceContentHash}`).digest("hex").slice(0, 20);
  const name = `Clone test ${suffix}`;
  const projectId = await control.createProject({ name, description: `Run-owned isolated clone destination ${suffix}`, domainId: input.domainId ?? "web-automation", authorizationPin: input.authorizationPin }, requestBounds(input));
  requiredText(projectId, "destination projectId");
  return { projectId, name };
}

/** Imports an approved package into a run-owned project using public APIs only. */
export async function importClonePackageIntoIsolatedDestination(
  control: IsolatedDestinationControl,
  input: { clonePackage: ClonePackage; destinationProjectId: string; authorizationPin: string } & FluxIQHttpOptions,
): Promise<IsolatedCloneImportResult> {
  assertClonePackage(input.clonePackage); requiredText(input.destinationProjectId, "destinationProjectId"); requiredText(input.authorizationPin, "authorizationPin");
  if (input.clonePackage.compatibility.verdict !== "compatible" || input.clonePackage.dependencies.some(item => item.decision === "reject")) fail("Incompatible clone package cannot be imported");
  const projectMapping = singleMapping(input.clonePackage.idMap, "project");
  const flowMapping = singleMapping(input.clonePackage.idMap, "flow");
  if (projectMapping.sourceId !== input.clonePackage.source.projectId || flowMapping.sourceId !== input.clonePackage.source.flowId) fail("Clone package identity map did not match its source identity");
  if (projectMapping.destinationId !== input.destinationProjectId) fail("Clone package destination project did not match the run-owned project");
  if (projectMapping.destinationId === projectMapping.sourceId || flowMapping.destinationId === flowMapping.sourceId) fail("Clone destination identifiers must differ from source identifiers");

  const bounds = requestBounds(input);
  const created = unwrapFlow(await control.createFlow({
    projectId: input.destinationProjectId, flowId: flowMapping.destinationId,
    name: requiredText(input.clonePackage.flowDocument.name, "flowDocument.name"),
    ...(typeof input.clonePackage.flowDocument.description === "string" && input.clonePackage.flowDocument.description ? { description: input.clonePackage.flowDocument.description } : {}),
    authorizationPin: input.authorizationPin,
  }, bounds), "create-flow");
  requireScope(created, input.destinationProjectId, flowMapping.destinationId, "created Flow");

  const remapped = remapCloneDocument(input.clonePackage.flowDocument, input.clonePackage.idMap, { timestamp: requiredFinite(created.updatedAt, "created Flow updatedAt"), dependencies: input.clonePackage.dependencies });
  if (stableJson(remapped.scope) !== stableJson(created.scope)) fail("Source Flow scope is incompatible with the destination project scope");
  const saved = unwrapFlow(await control.saveFlow({ projectId: input.destinationProjectId, flow: remapped as Readonly<JsonRecord>, expectedUpdatedAt: requiredFinite(created.updatedAt, "created Flow updatedAt"), authorizationPin: input.authorizationPin }, bounds), "save-flow");
  requireScope(saved, input.destinationProjectId, flowMapping.destinationId, "saved Flow");
  const readBack = unwrapFlow(await control.getFlow(input.destinationProjectId, flowMapping.destinationId, bounds), "get-flow");
  requireScope(readBack, input.destinationProjectId, flowMapping.destinationId, "read-back Flow");
  if (hashCanonicalJson(normalizeUpdatedAt(saved)) !== hashCanonicalJson(normalizeUpdatedAt(readBack))) fail("Destination Flow read-back content did not match the saved Flow");
  const attestation = attestCloneEquivalence(input.clonePackage.flowDocument, readBack as CloneJsonObject, input.clonePackage.idMap, input.clonePackage.dependencies);
  if (!attestation.equivalent) fail("Destination Flow changed fields outside the declared remapping", { differences: attestation.differences });
  return { projectId: input.destinationProjectId, flowId: flowMapping.destinationId, contentHash: hashCanonicalJson(readBack), document: readBack as CloneJsonObject, idMap: input.clonePackage.idMap, attested: true };
}

function requestBounds(input: FluxIQHttpOptions): FluxIQHttpOptions { return { ...(input.signal ? { signal: input.signal } : {}), ...(input.timeoutMs === undefined ? {} : { timeoutMs: input.timeoutMs }) }; }
function unwrapFlow(value: unknown, endpoint: string): JsonRecord { const envelope = record(value, `${endpoint} response`); if (envelope.ok !== true) fail(`${endpoint} did not return a successful public API envelope`); const payload = record(envelope.payload, `${endpoint} payload`); return record(payload.flow, `${endpoint} Flow`); }
function singleMapping(items: readonly CloneIdMapping[], kind: CloneIdMapping["kind"]): CloneIdMapping { const matches = items.filter(item => item.kind === kind); if (matches.length !== 1) fail(`Clone package must contain exactly one ${kind} ID mapping`); return matches[0]!; }
function requireScope(flow: JsonRecord, projectId: string, flowId: string, at: string): void { if (flow.projectId !== projectId || flow.flowId !== flowId) fail(`${at} escaped the run-owned destination scope`); }
function normalizeUpdatedAt(value: JsonRecord): JsonRecord { const copy = structuredClone(value); delete copy.updatedAt; return copy; }
function record(value: unknown, at: string): JsonRecord { if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${at} must be an object`); return value as JsonRecord; }
function requiredText(value: unknown, at: string): string { if (typeof value !== "string" || !value.trim()) fail(`${at} must be a non-empty string`); return value; }
function requiredDigest(value: unknown, at: string): string { const text = requiredText(value, at); if (!/^[a-f0-9]{64}$/.test(text)) fail(`${at} must be a SHA-256 digest`); return text; }
function requiredFinite(value: unknown, at: string): number { if (typeof value !== "number" || !Number.isFinite(value)) fail(`${at} must be finite`); return value; }
function stableJson(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`; if (value && typeof value === "object") return `{${Object.entries(value as JsonRecord).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(",")}}`; return JSON.stringify(value); }
function fail(message: string, details?: Readonly<Record<string, unknown>>): never { throw new RunnerFailure("recording.persistence", message, details ? { details } : {}); }
