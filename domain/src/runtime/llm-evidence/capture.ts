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

import type { AutomationStudioActionPermissionCheck } from "fluxiq/automation-studio";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import { webActionFailureRejectionCode, type WebFailedActionResult } from "./action-failure";
import { present } from "./present";
import { sanitizeWebLlmSnapshotWithBindings, type WebLlmSanitizeOptions, type WebLlmSnapshotBinding } from "./sanitize";
import { recoverable, RecoverableToolRejection, type WebLlmToolRejectionCode } from "./tool-rejection";
import { jsonRecord } from "./untrusted-json";

type ClientActionResult = WebFailedActionResult & {
  payload?: JsonObject;
  error?: string;
};

/**
 * Room kept for a page refusal's own envelope -- its schema version, `ok`,
 * code and the `page` key -- so the packet inside it and the refusal around
 * it together stay within what the call was allowed.
 */
const PAGE_REFUSAL_ENVELOPE_BYTES = 128;

export type WebLlmEvidenceGateway = {
  eligibleSessionIds(): string[];
  /**
   * The eligible sessions whose client declares repeating-structure detection
   * (`WEB_AUTOMATION_STRUCTURE_DETECTION_CAPABILITY_ID`). Absent, no session
   * does, and the detection tool refuses to run: a client that ignored the flag
   * would answer with a bare snapshot, which is not an answer.
   */
  structureDetectionSessionIds?(): string[];
  executeAction(sessionId: string, command: { actionType: string; parameters: JsonObject; metadata: JsonObject }): Promise<ClientActionResult>;
};

export type WebLlmEvidenceToolExecution = {
  kind: "llm_evidence_tool_execution";
  evidence: JsonValue;
  effectApplied: boolean;
  targetsUnchanged?: boolean;
  resultCode?: string;
  /**
   * What this one call did, for the draft Core is accruing.
   *
   * One tool runs whichever node of the library the call names, so the name to
   * record the step under, whether it looked or changed, and whether the Flow
   * should contain it are properties of the call rather than of the tool. Core
   * carries all of it opaquely (`AS/runtime/flow-draft/`).
   */
  draft?: {
    actionId?: string;
    input?: JsonObject;
    ranWith?: JsonObject;
    effect?: "observe" | "mutate";
    proposes?: boolean;
    /**
     * What running this call again would need: where it found the target, and
     * how much it read (`./node-run/replay.ts`). Saying it is what puts the
     * step under Core's dry run -- the draft is run again from the start before
     * it may be proposed -- and a step that says nothing is simply not replayed.
     */
    replay?: { from?: JsonObject; produced?: JsonObject };
  };
};

export type WebLlmEvidenceToolRequest = {
  projectId: string;
  flowId: string;
  callId: string;
  toolId: string;
  value: JsonObject;
  maxEvidenceBytes?: number;
  signal?: AbortSignal;
  /**
   * Where the Flow this build is writing starts, when the build was told
   * (`AS/runtime/flow-bootstrap/start-location.ts`). Core carries the value
   * from whoever asked for the build and never reads it; for this domain it is
   * a URL.
   *
   * Its presence says something about the world as well as about the request:
   * nothing was opened for this build, so there is no page until the Flow has
   * gone there. `node-run/start-location.ts` is where that has consequences --
   * the only call that works from nowhere is the one that goes there, and
   * because the Flow is assembled from the steps that ran, that call is then
   * the Flow's own first step.
   */
  startLocation?: string;
  /**
   * Core's check for an action with a lasting consequence, passed with every
   * tool call and harness option (`AS/runtime/action-permissions/`). Absent,
   * any declared consequence is refused rather than taken.
   */
  permission?: AutomationStudioActionPermissionCheck;
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

export function toolExecution(
  evidence: JsonValue,
  effectApplied: boolean,
  resultCode: string,
  targetsUnchanged?: boolean,
  draft?: WebLlmEvidenceToolExecution["draft"]
): WebLlmEvidenceToolExecution {
  return present<WebLlmEvidenceToolExecution>({ kind: "llm_evidence_tool_execution", evidence, effectApplied, targetsUnchanged, resultCode, draft });
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
  // A page that cannot be read now -- still loading, mid-navigation -- is a
  // condition the model can wait out or work around, not a fault.
  if (result.status !== "succeeded") recoverable("page_unreadable");
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
  if (result.status !== "succeeded") throw await pageRefusal(gateway, sessionId, request, current, webActionFailureRejectionCode(result), signal);
  return await captureEvidence(gateway, sessionId, request, signal, expectedOrigin ?? new URL(current.evidence.location).origin);
}

/**
 * The refusal for an action the page did not let happen, carrying the page as
 * it now stands: whatever got in the way -- a dialog, a banner -- is on it,
 * with a handle the model can press. Captured on the origin the action started
 * from and within the call's budget; a page that cannot be captured leaves the
 * bare code. Cancellation still ends the call.
 */
export async function pageRefusal(
  gateway: WebLlmEvidenceGateway,
  sessionId: string,
  request: WebLlmEvidenceToolRequest,
  current: WebLlmSnapshotBinding,
  code: WebLlmToolRejectionCode,
  signal?: AbortSignal
): Promise<RecoverableToolRejection> {
  const budget = request.maxEvidenceBytes === undefined ? undefined : request.maxEvidenceBytes - PAGE_REFUSAL_ENVELOPE_BYTES;
  if (budget !== undefined && budget < 1) return new RecoverableToolRejection(code, undefined);
  try {
    const page = await captureEvidence(gateway, sessionId, budget === undefined ? request : { ...request, maxEvidenceBytes: budget }, signal, new URL(current.evidence.location).origin);
    return new RecoverableToolRejection(code, undefined, page);
  } catch (error) {
    if (signal?.aborted) throw error;
    return new RecoverableToolRejection(code, undefined);
  }
}
