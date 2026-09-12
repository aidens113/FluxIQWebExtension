// The FluxIQ runtime adapter for the web-automation domain: the hop between a
// Core runtime command and the paired browser client.
//
// Two things happen here that happen nowhere else on the path. Every command
// that did not succeed leaves with a structured failure record, built from the
// closed code set in `./failure` -- the client's own record wins when it sent
// one, because it stood nearest the page, and otherwise the classifier reads
// the status and the message. Before this, a command that failed with only a
// message (an unpaired client, a refused output, a client-side timeout) reached
// Core with no record at all, and `failureForCommandStatus` had nothing but the
// status to classify from.
//
// And a failed command carries the page it failed on: the sanitized
// `web-llm-evidence.v1` packet is built here from the snapshot the content
// script captured at the instant of failure, bounded to Core's own
// failure-evidence gate, with the URL and the resolved target beside it. The
// alternative -- Core's `captureSanitizedFailureEvidence`, which opens a fresh
// snapshot when diagnosis runs -- describes a page that has since moved on.

import { createHash } from "node:crypto";
import type { FluxIQRuntimeAdapter, FluxIQRuntimeCommand, FluxIQRuntimeCommandResult, FluxIQRuntimeCommandStatus } from "fluxiq/runtime";
import type { FluxIQ } from "fluxiq";
import type { AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../constants";
import { WEB_AUTOMATION_ACTION_TYPES, type WebAutomationActionType } from "../actions/types";
import { dispatchWebAutomationOutput } from "../io/gateway-output-dispatcher";
import { outputTargetFromPayload } from "../output-nodes";
import { webAutomationRuntimeCapabilities } from "./capabilities";
import {
  WEB_AUTOMATION_FAILURE_CODES,
  classifyWebAutomationFailure,
  isWebAutomationFailureCode,
  webAutomationFailureRecord,
  type WebAutomationActionOutcome,
  type WebAutomationFailureCode,
  type WebAutomationFailureRecord
} from "./failure";
import { sanitizeWebLlmSnapshot, type WebLlmPageEvidence } from "./llm-evidence";

export type WebAutomationRuntimeAdapterOptions = {
  fluxiq: FluxIQ;
  adapterId?: string;
  label?: string;
};

export function createWebAutomationRuntimeAdapter(options: WebAutomationRuntimeAdapterOptions): FluxIQRuntimeAdapter {
  return {
    adapterId: options.adapterId ?? "web-automation.gateway",
    label: options.label ?? "Web Automation Gateway Runtime",
    transport: "direct",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    capabilities: () => webAutomationRuntimeCapabilities,
    canExecute: (command) => canExecuteWebAutomationCommand(command),
    execute: (command) => executeWebAutomationRuntimeCommand(options.fluxiq, command),
    captureSnapshot: (command) => captureWebAutomationSnapshot(options.fluxiq, command),
    readState: (command) => captureWebAutomationSnapshot(options.fluxiq, command)
  };
}

function canExecuteWebAutomationCommand(command: FluxIQRuntimeCommand): boolean {
  if (command.domainId !== undefined && command.domainId !== WEB_AUTOMATION_DOMAIN_ID) return false;
  if (command.kind === "capture_snapshot" || command.kind === "read_state") return true;
  if (command.kind !== "execute_action") return false;
  const outputId = command.outputId ?? command.actionType;
  return WEB_AUTOMATION_ACTION_TYPES.includes(outputId as never);
}

async function executeWebAutomationRuntimeCommand(fluxiq: FluxIQ, command: FluxIQRuntimeCommand): Promise<FluxIQRuntimeCommandResult> {
  const outputId = command.outputId ?? command.actionType;
  if (!outputId || !WEB_AUTOMATION_ACTION_TYPES.includes(outputId as never)) {
    return rejected(command, `Unsupported web automation output: ${outputId ?? "(missing)"}`, WEB_AUTOMATION_FAILURE_CODES.UNSUPPORTED_TYPE);
  }
  const payload = command.parameters ?? {};
  const startedAt = Date.now();
  const request: Parameters<typeof dispatchWebAutomationOutput>[1] = {
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    outputId,
    payload
  };
  if (command.metadata) request.metadata = command.metadata;
  const result = await dispatchWebAutomationOutput(fluxiq, request);
  const message = result.error ?? dispatchPayloadMessage(result.payload);
  // The command's own status, never a success flag. `timed_out` and
  // `cancelled` reach Core as themselves so `failureForCommandStatus`
  // (Core `io-policy.ts`) can classify them; flattening them to `failed`
  // left every unanswered action an undifferentiated failure.
  const status = result.status ?? (result.ok ? "succeeded" : "failed");
  const diagnostics = failureDiagnostics(status, result.payload);
  const failure = commandFailure(status, outputId as WebAutomationActionType, message, result.failure, diagnostics?.evidenceDigest);
  const runtimeResult: FluxIQRuntimeCommandResult = {
    commandId: command.commandId ?? `web.${Date.now()}`,
    status,
    startedAt,
    completedAt: Date.now(),
    ...(result.error ? { error: result.error } : {}),
    ...(message ? { message } : {}),
    ...(failure ? { failure } : {}),
    metadata: compact({
      outputId,
      ...(result.metadata ?? {}),
      ...(diagnostics ? { failureDiagnostics: diagnostics.report, ...(diagnostics.evidence ? { failureEvidence: diagnostics.evidence as unknown as JsonObject } : {}) } : {})
    })
  };
  if (result.payload !== undefined) runtimeResult.payload = result.payload;
  const target = outputTargetFromPayload(payload as JsonObject);
  if (target) runtimeResult.target = target;
  return runtimeResult;
}

async function captureWebAutomationSnapshot(fluxiq: FluxIQ, command: FluxIQRuntimeCommand): Promise<FluxIQRuntimeCommandResult> {
  const session = selectWebAutomationSession(fluxiq, command.metadata);
  if (!session) return rejected(command, "A single paired web-automation client must be selected before capturing state.", WEB_AUTOMATION_FAILURE_CODES.USER_INTERVENTION_REQUIRED);
  await fluxiq.programs.clientGateway.captureSnapshot(session.sessionId, {
    kind: command.kind === "read_state" ? "state" : "structured",
    ...(command.metadata ? { metadata: command.metadata } : {})
  });
  return {
    commandId: command.commandId ?? `web.snapshot.${Date.now()}`,
    status: "succeeded",
    completedAt: Date.now(),
    message: "Snapshot command dispatched to web automation client.",
    metadata: { sessionId: session.sessionId, clientId: session.clientId }
  };
}

function selectWebAutomationSession(fluxiq: FluxIQ, metadata: JsonObject | undefined) {
  const requestedSessionId = typeof metadata?.sessionId === "string" ? metadata.sessionId : undefined;
  const sessions = fluxiq.programs.clientGateway.snapshot().sessions.filter((session) =>
    (session.status === "connected" || session.status === "ready") &&
    session.clientType === "extension" &&
    session.capabilities.some((capability) =>
      capability.id === "web.actions" &&
      (capability.metadata?.domainId === WEB_AUTOMATION_DOMAIN_ID || capability.actionTypes?.some((actionType) => actionType.startsWith("web.")))
    )
  );
  if (requestedSessionId) return sessions.find((session) => session.sessionId === requestedSessionId);
  return sessions.length === 1 ? sessions[0] : undefined;
}

/**
 * A command the adapter refused before dispatching it. `rejected` is not one of
 * the statuses Core's `failureForCommandStatus` classifies, so without a record
 * the refusal reached the attempt as a bare message.
 */
function rejected(command: FluxIQRuntimeCommand, message: string, code: WebAutomationFailureCode): FluxIQRuntimeCommandResult {
  return {
    commandId: command.commandId ?? `web.rejected.${Date.now()}`,
    status: "rejected",
    completedAt: Date.now(),
    message,
    error: message,
    failure: webAutomationFailureRecord(code, { expected: "a dispatchable web automation command", actual: message })
  };
}

/**
 * The record for a command that did not succeed. A record the client sent wins
 * whenever this domain can name what it says -- it was built where the page
 * could be seen -- and gains only the digest of the evidence captured with it.
 * Everything else is classified from the status and the message.
 */
function commandFailure(
  status: FluxIQRuntimeCommandStatus,
  actionType: WebAutomationActionType,
  message: string | undefined,
  reported: AutomationStudioFailureRecord | undefined,
  evidenceDigest: string | undefined
): WebAutomationFailureRecord | undefined {
  const client = clientReportedFailure(reported);
  const outcome: WebAutomationActionOutcome = {
    // `rejected` is a dispatch status Core's command vocabulary has and the
    // client's does not; a client that refused an action did not run it, which
    // is a failure with a reason, so it classifies as one.
    status: status === "rejected" ? "failed" : status,
    actionType,
    ...(message === undefined ? {} : { message }),
    ...(client === undefined ? {} : { failure: client })
  };
  const failure = classifyWebAutomationFailure(undefined, outcome);
  if (failure === undefined) return undefined;
  if (evidenceDigest === undefined || failure.evidenceDigest !== undefined) return failure;
  return { ...failure, evidenceDigest };
}

/**
 * The client's own record, re-established on the closed set.
 *
 * This is the boundary the record crosses: it arrived over the WebSocket from
 * the browser, so its `code` is a bare string until something checks it, and
 * Core's own contract is to validate what crossed a process boundary. Nothing
 * did, which is how a code no part of this domain names could ride into an
 * attempt trace, where nothing downstream can act on it.
 *
 * A named code is rebuilt through `webAutomationFailureRecord` rather than
 * trusted field by field, so the category, the retryable flag and the stage are
 * the code's own rather than the sender's: a client one version behind cannot
 * pair a code with a category that contradicts it and have Core's parser drop
 * the failure whole. What only the sender could know -- what it expected, what
 * it saw, which evidence packet it captured -- is carried across untouched.
 *
 * A code this domain does not name is not a classification, whatever the sender
 * believed, so it becomes UNKNOWN carrying the code it used. That is what
 * `classifyWebAutomationFailure` already does with a runtime error's
 * unrecognized code, and the same drift deserves the same answer whichever way
 * it arrives.
 */
function clientReportedFailure(reported: AutomationStudioFailureRecord | undefined): WebAutomationFailureRecord | undefined {
  if (reported === undefined) return undefined;
  const { expected, actual, evidenceDigest } = reported;
  if (isWebAutomationFailureCode(reported.code)) return webAutomationFailureRecord(reported.code, { expected, actual, evidenceDigest });
  const unnamed = `unrecognized web automation failure code: ${reported.code}`;
  return webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.UNKNOWN, {
    expected,
    actual: actual === undefined ? unnamed : `${actual}; ${unnamed}`,
    evidenceDigest
  });
}

type FailureDiagnostics = {
  /** What rides in the attempt's metadata beside the packet. */
  report: JsonObject;
  evidence?: WebLlmPageEvidence | undefined;
  evidenceDigest?: string | undefined;
};

/**
 * What the failed command can say about where it failed: the page, the target
 * the client resolved, and the sanitized evidence packet built from the
 * snapshot the client captured at that instant.
 *
 * URLs are reduced to origin and path, as the evidence packet's own `location`
 * is, so a session token in a query string cannot ride into the attempt trace.
 * Nothing here can throw into the dispatch path: an unusable snapshot costs the
 * packet, never the failure it was meant to explain.
 */
function failureDiagnostics(status: FluxIQRuntimeCommandStatus, payload: JsonObject | undefined): FailureDiagnostics | undefined {
  if (status === "succeeded") return undefined;
  const actionResult = jsonObject(payload?.result);
  if (!actionResult) return undefined;
  const evidence = sanitizedFailureEvidence(actionResult.snapshot);
  const evidenceDigest = evidence === undefined ? undefined : createHash("sha256").update(JSON.stringify(evidence)).digest("hex");
  const report = compact({
    url: safeLocation(actionResult.url),
    title: boundedTitle(actionResult.title),
    selector: boundedSelector(jsonObject(actionResult.element)?.selector),
    evidenceDigest
  });
  if (Object.keys(report).length === 0) return undefined;
  return { report, ...(evidence ? { evidence } : {}), ...(evidenceDigest ? { evidenceDigest } : {}) };
}

/** The packet, bounded by Core's failure-evidence gate rather than by the larger exploration budget. */
function sanitizedFailureEvidence(snapshot: unknown): WebLlmPageEvidence | undefined {
  if (!jsonObject(snapshot)) return undefined;
  try {
    return sanitizeWebLlmSnapshot(snapshot, { maxEvidenceBytes: AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES });
  } catch {
    return undefined;
  }
}

/**
 * The message a command reported without an error: a succeeded action's
 * post-condition, or a status the client described in words only.
 * `dispatchWebAutomationOutput` carries it in the dispatch payload, and Core
 * builds the node result's message from `result.message ?? result.error`
 * (`createRuntimePolicyEffectDispatcher`), so an unpromoted message leaves the
 * attempt trace with no reason at all.
 */
function dispatchPayloadMessage(payload: JsonObject | undefined): string | undefined {
  const message = payload?.message;
  return typeof message === "string" && message.length > 0 ? message : undefined;
}

function safeLocation(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > 2_000) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.username || url.password ? undefined : `${url.origin}${url.pathname}`;
  } catch {
    return undefined;
  }
}

function boundedTitle(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value.slice(0, 300) : undefined;
}

function boundedSelector(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value.slice(0, 500) : undefined;
}

function jsonObject(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}

function compact(value: Record<string, unknown>): JsonObject {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as JsonObject;
}
