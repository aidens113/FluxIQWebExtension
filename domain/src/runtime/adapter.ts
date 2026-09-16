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
// `web-llm-evidence.v2` packet is built here from the snapshot the content
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
import { WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT, isProducerRedactedComparison, isSensitiveElementDescriptor } from "../sensitivity";
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
  // The client is given the command's own timeout -- its Flow node's, 5,000 ms
  // unless the node sets one -- so it gives up when the node does and answers
  // with its own `web.action.timeout`, carrying what it expected and saw. Core's
  // runtime waits that timeout plus its answer margin for the answer. A timeout
  // the runtime arms no deadline for (not a positive finite number) is not
  // sent, so the client keeps its own default, as it did before.
  if (command.timeoutMs !== undefined && Number.isFinite(command.timeoutMs) && command.timeoutMs > 0) request.timeoutMs = command.timeoutMs;
  const result = await dispatchWebAutomationOutput(fluxiq, request);
  const message = result.error ?? dispatchPayloadMessage(result.payload);
  // The command's own status, never a success flag. `timed_out` and
  // `cancelled` reach Core as themselves so `failureForCommandStatus`
  // (Core `io-policy.ts`) can classify them; flattening them to `failed`
  // left every unanswered action an undifferentiated failure.
  const status = result.status ?? (result.ok ? "succeeded" : "failed");
  const diagnostics = failureDiagnostics(status, result.payload);
  // Asked once, of the result the client sent, and used at both exits a
  // comparison takes from here: is the target a control that holds a secret,
  // and did the producer -- not a layer after it -- declare it had already
  // withheld the values? An absent declaration means withhold.
  const clientResult = jsonObject(result.payload?.result);
  const sensitiveTarget = isSensitiveElementDescriptor(clientResult?.element);
  const withholdComparison = sensitiveTarget && !producerDeclaredRedaction(clientResult?.validation);
  const failure = commandFailure(status, outputId as WebAutomationActionType, message, result.failure, diagnostics?.evidenceDigest, withholdComparison);
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
  if (result.payload !== undefined) {
    // A value read off a sensitive control is dropped on the rule's verdict
    // alone (D2). No declaration buys it back and no validation status skips
    // it, so it is asked here rather than inside the comparison guard, which
    // stands down for both.
    const readable = sensitiveTarget ? dispatchPayloadWithoutExtracted(result.payload) : result.payload;
    runtimeResult.payload = withholdComparison ? secretSafeDispatchPayload(readable) : readable;
  }
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
  evidenceDigest: string | undefined,
  withholdComparison: boolean
): WebAutomationFailureRecord | undefined {
  const client = clientReportedFailure(reported, withholdComparison);
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
 * `carriedWebAutomationFailure` already does with a thrown record's
 * unrecognized code, and the same drift deserves the same answer whichever way
 * it arrives.
 *
 * `expected` and `actual` are the one thing here that is *not* carried across
 * untouched. They are a comparison of what an action asked a control for and
 * what the control held, so on a control the sensitivity rule marks they are a
 * description of a secret, built in the content script by a redaction this side
 * of the wire cannot see. `withholdComparison` is the caller's answer to both
 * halves of that: the rule's verdict on the descriptor the client sent with the
 * same result, and whether the producer declared the strings already withheld
 * (`redacted` on that result's validation, which is what the producer builds
 * these two from). When it is yes, both strings are replaced with the shared
 * marker before the record reaches an attempt trace. The category, the code,
 * the retryable flag and the evidence digest are unaffected, so a Flow still
 * routes on the failure it was given.
 */
function clientReportedFailure(reported: AutomationStudioFailureRecord | undefined, withholdComparison: boolean): WebAutomationFailureRecord | undefined {
  if (reported === undefined) return undefined;
  const { evidenceDigest } = reported;
  const expected = secretSafeComparisonText(reported.expected, withholdComparison);
  const actual = secretSafeComparisonText(reported.actual, withholdComparison);
  if (isWebAutomationFailureCode(reported.code)) return webAutomationFailureRecord(reported.code, { expected, actual, evidenceDigest });
  const unnamed = `unrecognized web automation failure code: ${reported.code}`;
  return webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.UNKNOWN, {
    expected,
    actual: actual === undefined ? unnamed : `${actual}; ${unnamed}`,
    evidenceDigest
  });
}

/** One side of a comparison, withheld when the action ran on a control that holds a secret and nobody withheld it first. */
function secretSafeComparisonText(text: string | undefined, withholdComparison: boolean): string | undefined {
  if (text === undefined || !withholdComparison) return text;
  return WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT;
}

/**
 * Whether the producer declared the comparison withheld. A layer's stamp looks
 * identical, `redacted: true`: the extension's `webAutomationSecretSafeValidation`
 * stamped what it withheld until 1b6f5df, disarming this guard for every result,
 * and an older client still does. Only a layer writes the marker, and only when
 * the producer did not declare, so a flag beside it is never the producer's --
 * an exact test against this domain's constant, not a scan of the text.
 */
function producerDeclaredRedaction(validation: unknown): boolean {
  if (!isProducerRedactedComparison(validation)) return false;
  const { expected, actual } = validation as JsonObject;
  return expected !== WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT && actual !== WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT;
}

/**
 * The dispatch payload without the value a read took off the page, for an
 * action whose target the sensitivity rule marks (D2).
 *
 * `webAutomationActionResultPayload` drops it where the payload is built, but
 * that is the client's side of the WebSocket, for the reason given for
 * `secretSafeDispatchPayload` below. The two guards differ in what may stand
 * them down. A comparison is prose a producer can declare it built from a
 * length, and a `none` validation carries none to withhold; a read value is the
 * control's contents, so neither the declaration nor the validation's status is
 * consulted here, and the element is all that is asked.
 */
function dispatchPayloadWithoutExtracted(payload: JsonObject): JsonObject {
  const actionResult = jsonObject(payload.result);
  if (!actionResult || !("extracted" in actionResult)) return payload;
  const { extracted: _withheld, ...rest } = actionResult;
  return { ...payload, result: rest };
}

/**
 * The dispatch payload with the action result's own post-condition withheld.
 *
 * `webAutomationActionResultPayload` already withholds it where the payload is
 * built, but that runs in the client, and the client is on the far side of a
 * WebSocket: this module's whole reason for re-establishing the failure record
 * rather than trusting it is that what crossed a process boundary is validated
 * here. The same argument covers the payload the record came with. A client one
 * version behind, or a verb nobody taught the flag, is withheld exactly as it
 * was before the flag existed, because an absent declaration means withhold.
 *
 * A *false* declaration is another matter, and this guard does not survive one.
 * Both halves of `withholdComparison` read what the client sent: one boolean
 * disarms this payload withholding and `clientReportedFailure`'s record
 * withholding together, and omitting `element` disarms them just as completely
 * (pinned in `client/tests/gateway-mapping.test.ts`). Honouring the flag is
 * deliberate -- only the producer knows whether it wrote a length or a value
 * (`sensitivity/redaction.ts` argues the trade) -- so this is defence in depth
 * against *our own* producers, a verb that forgets to redact and so forgets to
 * declare, not a boundary against a client that lies. Nothing reachable here
 * would make it one: the dispatcher's `clientType` and `web.actions` gates
 * (`io/gateway-output-dispatcher.ts`) are both taken from the client's own
 * `client.hello`, so gating the flag on either gates one client claim on
 * another. The operator's pairing approval stands behind it, not this domain.
 *
 * This runs only when no producer declared, so a producer that withheld the
 * values itself keeps its phrasing here as on the record, and any `redacted`
 * flag present is a stamp (`producerDeclaredRedaction`). None leaves, not even
 * one that arrived: a passed-on stamp makes the next reader stand down, as it
 * did this one. Withholding already-withheld text is idempotent.
 *
 * Only the comparison is touched. `message`, which an operator reads, is left
 * as the client wrote it: it is free-form prose rather than a value read back
 * off a control, so there is nothing here that could judge it without a
 * predicate over text. The producer's own redaction is what keeps it safe.
 */
function secretSafeDispatchPayload(payload: JsonObject): JsonObject {
  const actionResult = jsonObject(payload.result);
  const validation = jsonObject(actionResult?.validation);
  if (!actionResult || !validation || validation.status === "none") return payload;
  const { redacted: _stamp, ...unstamped } = validation;
  return {
    ...payload,
    result: {
      ...actionResult,
      validation: {
        ...unstamped,
        ...(validation.expected === undefined ? {} : { expected: WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT }),
        ...(validation.actual === undefined ? {} : { actual: WEB_AUTOMATION_WITHHELD_COMPARISON_TEXT })
      }
    }
  };
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
  const evidence = sanitizedFailureEvidence(actionResult.snapshot, boundedSelector(jsonObject(actionResult.element)?.selector));
  const evidenceDigest = evidence === undefined ? undefined : createHash("sha256").update(JSON.stringify(evidence)).digest("hex");
  const report = compact({
    url: safeLocation(actionResult.url),
    title: boundedTitle(actionResult.title),
    // The handle the packet minted for the control, never the control's own
    // selector. This report rides into Core on the attempt's metadata, and a
    // selector is a browser concept Core does not carry (Phase T); the handle
    // says the same thing and addresses nothing.
    failedTarget: evidence?.failedTarget,
    failedTargetMissing: evidence?.failedTargetMissing,
    evidenceDigest
  });
  if (Object.keys(report).length === 0) return undefined;
  return { report, ...(evidence ? { evidence } : {}), ...(evidenceDigest ? { evidenceDigest } : {}) };
}

/**
 * The packet, bounded by Core's failure-evidence gate rather than by the larger
 * exploration budget, and told which control the action addressed so it can
 * mark that element with its own opaque handle. `failedAction` is passed even
 * when the client named no control, because `{}` is what makes the packet say
 * `failedTargetUnknown` rather than say nothing.
 */
function sanitizedFailureEvidence(snapshot: unknown, failedSelector: string | undefined): WebLlmPageEvidence | undefined {
  if (!jsonObject(snapshot)) return undefined;
  try {
    return sanitizeWebLlmSnapshot(snapshot, {
      maxEvidenceBytes: AUTOMATION_STUDIO_LLM_MAX_FAILURE_EVIDENCE_BYTES,
      failedAction: failedSelector === undefined ? {} : { selector: failedSelector }
    });
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
