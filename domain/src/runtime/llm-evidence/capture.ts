// Taking one bounded, sanitized look at the page, and acting on it first when
// the look needs an action to be worth taking.
//
// Every evidence tool in this repository ends up here: the authoring tools that
// help build a Flow, and the runtime harness options that explore a failure.
// They differ in what they are allowed to do and in who may offer them, and not
// at all in how a page becomes a packet -- so the capture lives in one module
// rather than once per caller. A second copy is how the two would come to
// sanitize to different budgets, or mark a failed target in one and not the
// other, without anybody deciding that they should.

import type { JsonObject, JsonValue } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import { present } from "./present";
import { sanitizeWebLlmSnapshotWithBindings, type WebLlmSanitizeOptions, type WebLlmSnapshotBinding } from "./sanitize";
import { jsonRecord } from "./untrusted-json";

type ClientActionResult = {
  status: string;
  payload?: JsonObject;
  error?: string;
};

export type WebLlmEvidenceGateway = {
  eligibleSessionIds(): string[];
  executeAction(sessionId: string, command: { actionType: string; parameters: JsonObject; metadata: JsonObject }): Promise<ClientActionResult>;
};

export type WebLlmEvidenceToolExecution = {
  kind: "llm_evidence_tool_execution";
  evidence: JsonValue;
  effectApplied: boolean;
  resultCode?: string;
};

export type WebLlmEvidenceToolRequest = {
  projectId: string;
  flowId: string;
  callId: string;
  toolId: string;
  value: JsonObject;
  maxEvidenceBytes?: number;
  signal?: AbortSignal;
};

/** Exactly one connected web client, or nothing: two would make "the page" ambiguous. */
export function selectSession(sessionIds: string[]): string {
  const unique = [...new Set(sessionIds)];
  if (unique.length !== 1) throw new Error("exactly one connected web-automation client is required for LLM evidence");
  return unique[0]!;
}

export function toolMetadata(input: WebLlmEvidenceToolRequest): JsonObject {
  return { source: "llm-evidence-runtime", projectId: input.projectId, flowId: input.flowId, callId: input.callId, domainId: WEB_AUTOMATION_DOMAIN_ID };
}

export function toolExecution(evidence: JsonValue, effectApplied: boolean, resultCode: string): WebLlmEvidenceToolExecution {
  return { kind: "llm_evidence_tool_execution", evidence, effectApplied, resultCode };
}

/** Cancellation is fatal, never a recoverable rejection: nothing is left to tell the model. */
export function assertActive(signal?: AbortSignal): void {
  if (signal?.aborted) throw signal.reason ?? new Error("web evidence operation was cancelled");
}

/** One capture, sanitized to the exploration budget, with its selectors kept behind. */
export async function captureEvidence(
  gateway: WebLlmEvidenceGateway,
  sessionId: string,
  request: WebLlmEvidenceToolRequest,
  signal?: AbortSignal,
  expectedOrigin?: string
): Promise<WebLlmSnapshotBinding> {
  const result = await gateway.executeAction(sessionId, {
    actionType: "web.dom.capture_snapshot",
    parameters: {},
    metadata: toolMetadata(request),
  });
  assertActive(signal);
  if (result.status !== "succeeded") throw new Error("web evidence snapshot capture failed");
  const payload = jsonRecord(result.payload, "web evidence action payload");
  return sanitizeWebLlmSnapshotWithBindings(payload.snapshot, present<WebLlmSanitizeOptions>({
    budget: "exploration",
    maxEvidenceBytes: request.maxEvidenceBytes,
    expectedOrigin,
    // An exploration packet is an observation, not a failure, so it marks no
    // target at all -- neither a handle nor a "the target is gone".
    failedAction: undefined,
  }));
}

/**
 * Do one thing to the page, then look again from where it left us.
 *
 * The recapture asserts where it landed. By default that is the origin the
 * action started from, which is what an interaction must never leave; a caller
 * that is deliberately moving -- a scoped navigation whose policy allowed
 * another place -- passes the destination instead, so the assertion still holds
 * and still means something rather than being waived.
 */
export async function actAndCapture(
  gateway: WebLlmEvidenceGateway,
  sessionId: string,
  request: WebLlmEvidenceToolRequest,
  actionType: string,
  parameters: JsonObject,
  current: WebLlmSnapshotBinding,
  signal?: AbortSignal,
  expectedOrigin?: string
): Promise<WebLlmSnapshotBinding> {
  const result = await gateway.executeAction(sessionId, { actionType, parameters, metadata: toolMetadata(request) });
  assertActive(signal);
  if (result.status !== "succeeded") throw new Error("web evidence interaction failed");
  return await captureEvidence(gateway, sessionId, request, signal, expectedOrigin ?? new URL(current.evidence.location).origin);
}
