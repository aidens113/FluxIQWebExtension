import { WEB_AUTOMATION_DOMAIN_ID } from "../constants";
import type { WebLlmPageEvidence } from "./llm-evidence";
import {
  produceWebReusableEvidence,
  WEB_REUSABLE_EVIDENCE_FINGERPRINT_SCHEMA_VERSION,
  type WebReusableEvidenceAction,
} from "./reusable-evidence";

export type CompletedWebReusableEvidenceOutcome = "succeeded" | "failed" | "rejected" | "reverted";
export type WebReusableEvidenceReviewerState = "unreviewed" | "approved" | "rejected" | "reverted";
export type WebReusableEvidenceValidationState = "unknown" | "validated" | "applied";

export type WebReusableLlmContextPutRequest = Readonly<{
  projectId: string;
  record: {
    recordId?: string;
    flowId: string;
    subflowId?: string;
    domainId: typeof WEB_AUTOMATION_DOMAIN_ID;
    evidenceKind: string;
    evidenceSchemaVersion: string;
    sanitizerVersion: string;
    compatibilityTags: Array<{ name: string; value: string }>;
    promptProjection: unknown;
    outcome: CompletedWebReusableEvidenceOutcome;
    reviewerState: WebReusableEvidenceReviewerState;
    validationState: WebReusableEvidenceValidationState;
    sourceRunIds: string[];
    sourceAdaptationIds: string[];
    createdAt: number;
    ttlMs?: number;
  };
}>;

export type WebReusableEvidenceWritePort = {
  putReusableLlmContext(request: WebReusableLlmContextPutRequest): Promise<{
    ok: boolean;
    payload?: { context?: { recordId?: string; contentDigest?: string } };
  }>;
};

export type CompletedWebReusableEvidenceInput = Readonly<{
  enabled: boolean;
  completionStatus: "completed";
  projectId: string;
  flowId: string;
  subflowId?: string;
  recordId?: string;
  evidenceKind: "exploration" | "runtime_failure" | "adaptation_validation";
  evidence: WebLlmPageEvidence;
  actions?: readonly WebReusableEvidenceAction[];
  clientCapabilities?: readonly string[];
  outcome: CompletedWebReusableEvidenceOutcome;
  reviewerState: WebReusableEvidenceReviewerState;
  validationState: WebReusableEvidenceValidationState;
  sourceRunIds?: readonly string[];
  sourceAdaptationIds?: readonly string[];
  completedAt: number;
  ttlMs?: number;
}>;

export function mapCompletedWebReusableEvidenceToPutRequest(input: CompletedWebReusableEvidenceInput): WebReusableLlmContextPutRequest {
  if (input.completionStatus !== "completed") throw new Error("Reusable web evidence can be written only after completion");
  const projectId = identifier(input.projectId, "project");
  const flowId = identifier(input.flowId, "Flow");
  const subflowId = input.subflowId === undefined ? undefined : identifier(input.subflowId, "Subflow");
  const recordId = input.recordId === undefined ? undefined : identifier(input.recordId, "record");
  const sourceRunIds = identifiers(input.sourceRunIds ?? [], "source run");
  const sourceAdaptationIds = identifiers(input.sourceAdaptationIds ?? [], "source adaptation");
  if (!sourceRunIds.length && !sourceAdaptationIds.length) throw new Error("Reusable web evidence requires explicit source provenance");
  if (!Number.isSafeInteger(input.completedAt) || input.completedAt < 0) throw new Error("Reusable web evidence completion time is invalid");
  if (input.ttlMs !== undefined && (!Number.isSafeInteger(input.ttlMs) || input.ttlMs < 1)) throw new Error("Reusable web evidence TTL is invalid");
  const produced = produceWebReusableEvidence({
    evidence: input.evidence,
    ...(input.actions === undefined ? {} : { actions: input.actions }),
    ...(input.clientCapabilities === undefined
      ? {}
      : { clientCapabilities: input.clientCapabilities }),
  });
  const compatibilityTags = produced.fingerprint.compatibilityTags.map((tag) => {
    const separator = tag.indexOf(":");
    if (separator < 1 || separator === tag.length - 1) throw new Error("Reusable web evidence compatibility tag is malformed");
    return { name: tag.slice(0, separator), value: tag.slice(separator + 1) };
  });
  compatibilityTags.push({ name: "web.fingerprint", value: produced.fingerprint.digest });
  compatibilityTags.push({ name: "web.fingerprint-schema", value: WEB_REUSABLE_EVIDENCE_FINGERPRINT_SCHEMA_VERSION });
  compatibilityTags.sort((left, right) => left.name.localeCompare(right.name) || left.value.localeCompare(right.value));
  return {
    projectId,
    record: {
      ...(recordId ? { recordId } : {}),
      flowId,
      ...(subflowId ? { subflowId } : {}),
      domainId: WEB_AUTOMATION_DOMAIN_ID,
      evidenceKind: input.evidenceKind,
      evidenceSchemaVersion: produced.fingerprint.evidenceSchemaVersion,
      sanitizerVersion: produced.fingerprint.sanitizerVersion,
      compatibilityTags,
      promptProjection: produced.promptProjection,
      outcome: input.outcome,
      reviewerState: input.reviewerState,
      validationState: input.validationState,
      sourceRunIds,
      sourceAdaptationIds,
      createdAt: input.completedAt,
      ...(input.ttlMs === undefined ? {} : { ttlMs: input.ttlMs }),
    },
  };
}

export async function writeCompletedWebReusableEvidence(
  input: CompletedWebReusableEvidenceInput,
  port: WebReusableEvidenceWritePort,
): Promise<{ status: "disabled" } | { status: "stored"; recordId: string; contentDigest: string }> {
  if (input.enabled !== true) return { status: "disabled" };
  const request = mapCompletedWebReusableEvidenceToPutRequest(input);
  let response: Awaited<ReturnType<WebReusableEvidenceWritePort["putReusableLlmContext"]>>;
  try {
    response = await port.putReusableLlmContext(request);
  } catch {
    throw new Error("Protected reusable-context write was rejected by Core");
  }
  const recordId = response.payload?.context?.recordId;
  const contentDigest = response.payload?.context?.contentDigest;
  if (!response.ok || typeof recordId !== "string" || !recordId || typeof contentDigest !== "string" || !/^[a-f0-9]{64}$/u.test(contentDigest)) {
    throw new Error("Protected reusable-context write was rejected by Core");
  }
  return { status: "stored", recordId, contentDigest };
}

function identifiers(input: readonly string[], label: string): string[] {
  if (input.length > 25) throw new Error(`Reusable web evidence ${label} IDs exceed 25`);
  return [...new Set(input.map(value => identifier(value, label)))].sort();
}

function identifier(input: string, label: string): string {
  const value = typeof input === "string" ? input.trim() : "";
  if (!value || value.length > 200 || !/^[A-Za-z0-9._:-]+$/u.test(value)) throw new Error(`Reusable web evidence ${label} ID is invalid`);
  return value;
}
