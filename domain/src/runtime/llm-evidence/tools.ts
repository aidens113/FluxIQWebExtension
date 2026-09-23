// The web-only evidence this domain binds into Core's domain-neutral LLM
// harness, and the post-failure capture the runtime diagnosis path calls.
//
// **There used to be five tools here, and they were the wrong five.** Inspect,
// navigate, press, enter-field and detect were verbs invented for exploring,
// while the Flow a build wrote was made of the registry's own output nodes. Two
// vocabularies for one job, so what a build proved while exploring was never
// what shipped, and a node could enter a Flow having never once run. The user's
// instruction on 2026-09-22 was to delete the split: the exploratory output is
// to be the same nodes with the same parameters, so a Flow can be assembled
// from steps that provably worked.
//
// So this domain now declares `runsNodes`, and Core offers the library itself
// as one option (`AS/runtime/llm/node-tools/`): the call names a node of the
// registry and carries that node's own parameters, and `./node-run/` resolves
// the handles through the same resolver the finished Flow's parameters go
// through and dispatches the same gateway command the finished Flow dispatches.
// Four of the five verbs are gone -- a press is `web.dom.click`, an entry is
// `web.dom.type` or `web.dom.select`, a move is `web.browser.navigate`, a look
// is `web.dom.capture_snapshot`.
//
// **Detection stays**, and it is the one thing here that is not a node. An
// extraction node cannot be written without the opaque handle it issues, and
// finding a list is an observation about the page rather than a step of any
// Flow (`structure/`).
//
// Everything returned is a sanitized packet; everything refused returns a code
// and one closed reason for it, and nothing of the page beyond what a packet
// already shows (`./tool-rejection.ts`). Nothing is refused on FluxIQ's own
// judgement of what a control looks like: the model declares what its own call
// would lastingly do and Core's gate answers from the person's instruction and
// grant (`./permission.ts`).

import type { FluxIQ } from "fluxiq";
import type {
  AutomationStudioExplorationStopReason,
  AutomationStudioHarnessOptionBundle,
  AutomationStudioRuntimeTargetOverrideEvidenceValidation,
  AutomationStudioRuntimeTargetOverrideFailedAction,
  AutomationStudioRuntimeTargetOverrideTarget
} from "fluxiq/automation-studio";
import { AUTOMATION_STUDIO_ACTION_CONSEQUENCES } from "fluxiq/automation-studio";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import { WEB_AUTOMATION_STRUCTURE_DETECTION_CAPABILITY_ID } from "../capabilities";
import {
  assertActive,
  captureEvidence,
  pageRefusal,
  selectSession,
  toolExecution,
  toolMetadata,
  type WebLlmEvidenceGateway,
  type WebLlmEvidenceToolExecution,
  type WebLlmEvidenceToolRequest
} from "./capture";
import {
  webAutomationExplorationRefusalClassifier,
  webAutomationRecoveryHarnessOptionBundle
} from "./harness-options";
import { evidenceByteLimit, serializedBytes, WEB_LLM_EVIDENCE_BOUNDS, WEB_LLM_EVIDENCE_BYTE_BUDGETS } from "./limits";
import { WEB_LLM_DENIED_EVIDENCE_KEYS } from "./denied-keys";
import { evidenceLocation, safeEvidenceUrl } from "./location";
import { runWebOutputNode, webObservationNodeId } from "./node-run";
import {
  createWebLlmTargetPackets,
  resolveWebPlanNodeParameters,
  type WebPlanNodeResolution,
  type WebPlanNodeResolutionInput
} from "./plan-resolution";
import { present } from "./present";
import { webFailureRepairParameters } from "./repairable-parameters";
import { webLlmStateDigest } from "./state-digest";
import { webLlmTargetsUnchanged } from "./target";
import { createWebLlmStableTargetHandles, WEB_LLM_TARGET_HANDLE_PATTERN } from "./stable-handles";
import {
  createWebLlmExtractionHandles,
  detectRepeatingStructure,
  type WebLlmExtractionHandleResolution,
  type WebLlmExtractionHandleScope
} from "./structure";
import {
  sanitizeWebLlmSnapshotWithBindings,
  WEB_LLM_EVIDENCE_SCHEMA_VERSION,
  type WebLlmPageEvidence,
  type WebLlmSanitizeOptions,
  type WebLlmSnapshotBinding
} from "./sanitize";
import { projectWebRepairCandidates, validateWebRuntimeTargetOverrideEvidence } from "./target";
import { webActionFailureRejectionCode } from "./action-failure";
import { recoverable, RecoverableToolRejection, rejectionDetail, toolRejection } from "./tool-rejection";
import { boundedIdentifier, jsonRecord } from "./untrusted-json";
import {
  webLlmToolRejectionResultCode,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_RUN_NODE_TOOL_ID
} from "./vocabulary";

// A handle the authoring tools issue: numbered for the whole Flow, so up to four digits (`./stable-handles.ts`).
const TARGET_HANDLE_PATTERN = WEB_LLM_TARGET_HANDLE_PATTERN;
const TARGET_HANDLE = new RegExp(TARGET_HANDLE_PATTERN, "u");

export type WebLlmFailureEvidenceRequest = {
  projectId: string;
  flowId: string;
  runId: string;
  failedAction: {
    attemptId: string;
    nodeId: string;
    definitionId: string;
    status: string;
    route?: string;
  };
  /** Core always names one; absent, the packet falls back to Core's own failure-evidence gate. */
  maxEvidenceBytes?: number;
  signal?: AbortSignal;
};

/** One moment Core wants the page's state digested at, named by the action it brackets. */
export type WebLlmStateDigestRequest = {
  projectId: string;
  flowId: string;
  /** The exploration step's call id, the same one its trace entry carries. */
  callId: string;
  toolId: string;
  /** Whether the action is about to run, or has just run. */
  phase: "before" | "after";
  signal?: AbortSignal;
};

export type WebAutomationLlmEvidenceRuntime = {
  /** Whose options these are. Core scopes the harness-option registry by it, so the slot cannot be bound anonymously. */
  domainId: string;
  /** The keys Core refuses in evidence from this domain. Core carries no browser vocabulary of its own, so the domain that knows what these words mean declares them and Core enforces the declaration. Required here, because the producer always knows: an evidence runtime that declared nothing would silently deny nothing. */
  deniedEvidenceKeys: readonly string[];
  tools: Array<{ toolId: string; description: string; inputSchema: JsonObject; effect?: "observe" | "mutate"; repeatPolicy?: "after_mutation"; initialObservation?: { input: JsonObject } }>;
  /**
   * That this domain can run a node of the library against its live page, and
   * which node one free first look runs.
   *
   * Core reads it and offers the library as one more option, enumerating the
   * node ids from the registry itself, so a node registered later is runnable
   * with nothing here to edit (`AS/runtime/llm/harness-options/binding.ts`).
   */
  runsNodes?: { initial?: JsonObject };
  /** Options declared in full rather than as bare tools, so a runtime-only recovery option never reaches Flow authoring. */
  harnessOptions: AutomationStudioHarnessOptionBundle;
  /** How Core reads one of this domain's result codes as a refusal, without learning any of them. */
  classifyRefusal: (resultCode: string) => AutomationStudioExplorationStopReason | undefined;
  executeTool(input: WebLlmEvidenceToolRequest): Promise<WebLlmEvidenceToolExecution>;
  /**
   * What the page was at one moment, as the opaque digest Core compares for
   * equality either side of each exploration action.
   *
   * It is the one thing Core's exploration reducer cannot work out for itself:
   * Core's own digest is of the evidence a step returned, which is what the step
   * said rather than what the page was. This takes a fresh sanitized capture and
   * hashes a projection of it (`state-digest.ts`), which is why it widens
   * nothing -- the input is the same packet the model would have been shown, and
   * what leaves is a hash of less of it.
   */
  captureStateDigest(input: WebLlmStateDigestRequest): Promise<string>;
  captureSanitizedFailureEvidence(input: WebLlmFailureEvidenceRequest): Promise<WebLlmPageEvidence>;
  validateTargetOverrideEvidence(evidence: JsonObject, target: AutomationStudioRuntimeTargetOverrideTarget, failedAction: AutomationStudioRuntimeTargetOverrideFailedAction): AutomationStudioRuntimeTargetOverrideEvidenceValidation;
  /**
   * What an extraction handle the detection tool issued stands for: the
   * `web.dom.extract_list` request, the page and the frame. The one way to turn
   * a handle a model put in a plan into real parameters. A handle is resolved
   * only for the project and Flow it was issued to; any other answer is
   * `unknown_handle`, and one the bounded store has let go is `stale_handle`.
   */
  resolveExtractionHandle(input: WebLlmExtractionHandleScope & { handle: string }): WebLlmExtractionHandleResolution;
  /**
   * A plan node's parameters with the handles the model wrote in them made
   * real: a `selector` written `{ handle: "target.N" }` becomes the selector
   * behind the handle this project and Flow's exploration was shown, and the
   * extraction node's `extractList` written `{ handle: "extraction.N" }`
   * becomes the request behind it (`plan-resolution/`). A node with no handle
   * is `unchanged`; any handle that cannot be made real refuses the node with
   * named codes. Core calls it before a plan is validated.
   *
   * Awaited, because the step is then put to Core's permission check
   * (`plan-resolution/step-permission.ts`): a step that would lastingly do
   * something the run is not permitted answers `needs_permission`, and a step
   * that presses without saying what pressing would do is refused.
   */
  resolvePlanNodeParameters(input: WebPlanNodeResolutionInput): Promise<WebPlanNodeResolution>;
};

/**
 * How many packets' selector bindings are kept so a later repair can still put
 * the selector hint back. Small on purpose: this is a convenience for the
 * in-flight diagnosis, not a store, and a repair that finds no binding is
 * resolved fingerprint-only rather than refused. Failure packets get a window
 * of their own: the target check always needs the failure packet, while an
 * exploration returns any number of packets and Core carries only the newest
 * to the repair, so the oldest explored binding is the one to let go.
 */
const RETAINED_SELECTOR_BINDINGS = 8;

export function createWebAutomationLlmEvidenceRuntime(gateway: WebLlmEvidenceGateway): WebAutomationLlmEvidenceRuntime {
  // Which node one free look runs, read from this domain's own definitions
  // rather than named here (`./node-run/catalog.ts`).
  const observationNode = webObservationNodeId();
  const returnedEvidence = new Map<string, WebLlmSnapshotBinding>();
  const extractionHandles = createWebLlmExtractionHandles();
  const targetPackets = createWebLlmTargetPackets();
  // A handle keeps naming the control it named across recaptures of one page
  // (see ./stable-handles.ts). Every authoring capture goes through it, including
  // the ones the model is not shown, so a press's before-and-after comparison
  // and its target binding read the same numbering as the packet.
  const stableHandles = createWebLlmStableTargetHandles();
  const stable = (request: WebLlmEvidenceToolRequest, binding: WebLlmSnapshotBinding): WebLlmSnapshotBinding =>
    stableHandles.restamp({ projectId: request.projectId, flowId: request.flowId }, binding);
  // Every packet an authoring tool shows the model: kept for the next repair
  // (`retain`), for the next press or detection, and for resolving the plan.
  const shown = (input: WebLlmEvidenceToolRequest, sessionId: string, snapshot: WebLlmSnapshotBinding): void => {
    returnedEvidence.set(evidenceScope(input, sessionId), snapshot);
    targetPackets.remember({ projectId: input.projectId, flowId: input.flowId }, snapshot);
  };
  // Keyed by the packet itself, because Core hands the packet back to
  // `validateTargetOverrideEvidence` without the project or flow it came from.
  const failureSelectors = new Map<string, Map<string, string>>();
  const toolSelectors = new Map<string, Map<string, string>>();
  const retainIn = (window: Map<string, Map<string, string>>) => (binding: WebLlmSnapshotBinding): WebLlmSnapshotBinding => {
    keepNewest(window, packetKey(binding.evidence), binding.selectors);
    return binding;
  };
  const retain = retainIn(toolSelectors);
  const retainFailure = retainIn(failureSelectors);
  return {
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    // Declared once, in `./denied-keys.ts`, because what a reading node read
    // is held to the same list before it is ever returned.
    deniedEvidenceKeys: WEB_LLM_DENIED_EVIDENCE_KEYS,
    // The options a runtime recovery may explore with, declared in full so
    // they carry their own availability, safety and stages and never reach
    // Flow authoring. `same_scope` is the safe default and matches what the
    // authoring `navigate` tool below already enforces; a per-run allowlist
    // is per-exploration, so threading one needs the coordinator, not this
    // line.
    harnessOptions: webAutomationRecoveryHarnessOptionBundle({ gateway, scopePolicy: { kind: "same_scope" }, retainSelectors: retain, extractionHandles }),
    // How Core reads a refusal without learning any of this domain's result
    // codes.
    classifyRefusal: webAutomationExplorationRefusalClassifier,
    // Detection alone. Everything else a build does is a node of the library,
    // which Core offers because Core is what enumerates the registry; this
    // domain says it can run one (`runsNodes`) and runs whichever the call
    // names (`./node-run/`).
    tools: [
      {
        toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
        description: "Detect the repeating list or table an extraction would read: around an observed element when given its opaque target handle, else the page's largest list. Returns an opaque extraction handle naming it, each field's key, label, kind and coverage, the item count, and how the list continues. Returns no values or selectors. Observes only, and is never a step of the Flow. Write the list into the extraction node as extractList: {handle, fields?: {yourKey: \"fieldKey\" | \"fieldKey@attr\"}, paginate?: false, minItems?: 0}, then run that node to see the rows it really reads. Its count is the whole list: where the Flow returns only part of it, narrow the page first, minItems: 0 where the answer may be no rows.",
        inputSchema: { type: "object", properties: { target: { type: "string", pattern: TARGET_HANDLE_PATTERN } }, additionalProperties: false },
        effect: "observe",
      },
    ],
    // One free look before the first paid decision, so the model's first
    // question is asked with the page already in front of it. The argument is
    // this domain's, not the model's, which is what makes it safe to take.
    runsNodes: observationNode ? { initial: { node: observationNode, parameters: {}, consequences: [] } } : {},
    async executeTool(input) {
      assertActive(input.signal);
      boundedIdentifier(input.projectId, "projectId");
      boundedIdentifier(input.flowId, "flowId");
      boundedIdentifier(input.callId, "callId");
      const sessionId = selectSession(gateway.eligibleSessionIds());
      try {
        if (input.toolId === WEB_LLM_RUN_NODE_TOOL_ID) {
          return await runWebOutputNode({
            gateway,
            sessionId,
            request: input,
            stores: { targets: targetPackets, extractions: extractionHandles },
            restamp: (binding) => retain(stable(input, binding)),
            shown: (binding) => shown(input, sessionId, binding)
          });
        }
        if (input.toolId === WEB_LLM_DETECT_STRUCTURE_TOOL_ID) {
          return await detectRepeatingStructure({
            gateway,
            sessionId,
            request: input,
            returned: returnedEvidence.get(evidenceScope(input, sessionId)),
            handles: extractionHandles,
          });
        }
        throw new Error("web evidence tool is not registered");
      } catch (error) {
        if (error instanceof RecoverableToolRejection) {
          // A refusal the page caused carries the page: it is shown like any
          // other packet, so the handles on it -- the dialog's close button --
          // can be pressed next.
          const page = error.page === undefined ? undefined : retain(stable(input, error.page));
          if (page !== undefined) shown(input, sessionId, page);
          return toolExecution(toolRejection(error.code, page?.evidence, error.detail), false, webLlmToolRejectionResultCode(error.code));
        }
        throw error;
      }
    },
    async captureStateDigest(input) {
      assertActive(input.signal);
      boundedIdentifier(input.projectId, "projectId");
      boundedIdentifier(input.flowId, "flowId");
      boundedIdentifier(input.callId, "callId");
      const sessionId = selectSession(gateway.eligibleSessionIds());
      // A fresh capture, sanitized by the one path every packet goes through,
      // and then thrown away. It is deliberately not `retain`ed and not `shown`:
      // no model is ever given it, no handle it issues is ever resolvable, and
      // letting it into the packet windows would age out a packet the model
      // does read. No expected origin either -- an exploration action may
      // legitimately move the page, and this has to describe wherever it landed.
      const snapshot = await captureEvidence(gateway, sessionId, present<WebLlmEvidenceToolRequest>({
        projectId: input.projectId,
        flowId: input.flowId,
        callId: input.callId,
        toolId: input.toolId,
        value: {},
        permission: undefined,
        maxEvidenceBytes: undefined,
        signal: input.signal,
      }), input.signal);
      return webLlmStateDigest(snapshot.evidence);
    },
    async captureSanitizedFailureEvidence(input) {
      assertActive(input.signal);
      boundedIdentifier(input.projectId, "projectId");
      boundedIdentifier(input.flowId, "flowId");
      boundedIdentifier(input.runId, "runId");
      boundedIdentifier(input.failedAction.attemptId, "failedAction.attemptId");
      boundedIdentifier(input.failedAction.nodeId, "failedAction.nodeId");
      boundedIdentifier(input.failedAction.definitionId, "failedAction.definitionId");
      const sessionId = selectSession(gateway.eligibleSessionIds());
      const result = await gateway.executeAction(sessionId, {
        actionType: "web.dom.capture_snapshot",
        parameters: {},
        metadata: {
          source: "llm-runtime-failure-evidence",
          domainId: WEB_AUTOMATION_DOMAIN_ID,
          projectId: input.projectId,
          flowId: input.flowId,
          runId: input.runId,
          attemptId: input.failedAction.attemptId,
          nodeId: input.failedAction.nodeId,
          definitionId: input.failedAction.definitionId,
        },
      });
      assertActive(input.signal);
      if (result.status !== "succeeded") throw new Error("web failure evidence snapshot capture failed");
      const payload = jsonRecord(result.payload, "web failure evidence action payload");
      const totalBudget = evidenceByteLimit(input.maxEvidenceBytes, WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure, WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure);
      const candidateBudget = Math.min(1_024, Math.floor(totalBudget / 3));
      const binding = sanitizeWebLlmSnapshotWithBindings(payload.snapshot, present<WebLlmSanitizeOptions>({
        budget: "failure",
        maxEvidenceBytes: totalBudget - candidateBudget,
        expectedOrigin: undefined,
        // Core's failed-action identity is an attempt, a node and a definition
        // id, and carries nothing about the control -- so this recapture marks
        // no target and says `failedTargetUnknown` rather than leaving the
        // model to read the silence as "the target is still there". What it
        // does carry is enough to name the parameters a repair fills, which
        // Core tells the model to fill from this packet; without them a correct
        // live repair was refused for guessing the key.
        failedAction: { repairParameters: webFailureRepairParameters({ definitionId: input.failedAction.definitionId }) },
      }));
      // The candidate object's own bytes are not the whole cost of attaching
      // it: JSON also adds the comma, property name and colon. Measure that
      // envelope against this exact packet so the final serialized evidence,
      // not merely each independently bounded part, stays inside Core's gate.
      const baseBytes = serializedBytes(binding.evidence);
      const envelopeBytes = serializedBytes({ ...binding.evidence, repairCandidates: null }) - baseBytes - serializedBytes(null);
      const availableCandidateBytes = Math.min(candidateBudget, totalBudget - baseBytes - envelopeBytes);
      const candidates = projectWebRepairCandidates(binding.evidence.elements, { definitionId: input.failedAction.definitionId }, availableCandidateBytes);
      if (candidates) binding.evidence.repairCandidates = candidates;
      return retainFailure(binding).evidence;
    },
    validateTargetOverrideEvidence(evidence, target, failedAction) {
      // Judged before the target: a packet of another version, or not a packet
      // at all, is not one this domain issued, whatever handles it holds.
      if (evidence.schemaVersion !== WEB_LLM_EVIDENCE_SCHEMA_VERSION || !Array.isArray(evidence.elements)) return { status: "absent", reason: "evidence_unrecognized" };
      return validateWebRuntimeTargetOverrideEvidence(
        evidence as WebLlmPageEvidence,
        target,
        failedAction,
        // Equal keys describe equal elements, so a binding from either window fits.
        failureSelectors.get(packetKey(evidence as WebLlmPageEvidence)) ?? toolSelectors.get(packetKey(evidence as WebLlmPageEvidence))
      );
    },
    resolveExtractionHandle(input) {
      return extractionHandles.resolve({ projectId: input.projectId, flowId: input.flowId }, input.handle);
    },
    resolvePlanNodeParameters(input) {
      return resolveWebPlanNodeParameters(input, { targets: targetPackets, extractions: extractionHandles });
    },
  };
}

/** Bind web-only evidence tools into Core's domain-neutral global LLM harness. */
export function bindWebAutomationLlmEvidenceRuntime(fluxiq: FluxIQ): void {
  fluxiq.programs.automationStudio.bindLlmEvidenceRuntime(createWebAutomationLlmEvidenceRuntime({
    eligibleSessionIds: () => eligibleWebSessionIds(fluxiq),
    structureDetectionSessionIds: () => eligibleWebSessionIds(fluxiq, WEB_AUTOMATION_STRUCTURE_DETECTION_CAPABILITY_ID),
    executeAction: (sessionId, command) => fluxiq.programs.automationStudioClientGateway.executeAction(sessionId, command),
  }));
}


/** The sessions every evidence tool may use, narrowed to those that also declare `alsoDeclaring` when it is named. */
function eligibleWebSessionIds(fluxiq: FluxIQ, alsoDeclaring?: string): string[] {
  return fluxiq.programs.clientGateway.snapshot().sessions.filter((session) =>
    session.status === "ready" &&
    session.clientType === "extension" &&
    !session.activeRecordingId &&
    session.capabilities.some((capability) =>
      capability.id === "web.actions" &&
      (capability.metadata?.domainId === WEB_AUTOMATION_DOMAIN_ID || capability.actionTypes?.includes("web.dom.capture_snapshot"))
    ) &&
    (alsoDeclaring === undefined || session.capabilities.some((capability) => capability.id === alsoDeclaring))
  ).map((session) => session.sessionId);
}

/** Keep `selectors` as the newest entry, re-inserted when shown again, and let the oldest go past the bound. */
function keepNewest(window: Map<string, Map<string, string>>, key: string, selectors: Map<string, string>): void {
  window.delete(key);
  window.set(key, selectors);
  for (const oldest of window.keys()) {
    if (window.size <= RETAINED_SELECTOR_BINDINGS) break;
    window.delete(oldest);
  }
}

/**
 * A packet's identity for the binding lookup: its location and every element
 * it describes, whole. A failure packet numbers its handles from 1 -- only the
 * authoring tools number them for the whole Flow (`./stable-handles.ts`) -- so
 * keyed on handles alone two captures of one page with one element count collided, and
 * a repair got the hint of a different control. Keyed on the elements, equal
 * keys mean equal fingerprints at every handle. Core round-trips the packet
 * through JSON, which reproduces this serialization, so it is matched on what
 * the packet says rather than on object identity, and a packet that was
 * trimmed, recaptured, re-ranked or edited no longer matches.
 */
function packetKey(evidence: WebLlmPageEvidence): string {
  return `${evidence.location} ${JSON.stringify(evidence.elements)}`;
}

function evidenceScope(input: WebLlmEvidenceToolRequest, sessionId: string): string {
  return `${sessionId}\0${input.projectId}\0${input.flowId}`;
}

function requestedUrl(input: unknown): URL {
  try {
    return safeEvidenceUrl(input);
  } catch {
    return recoverable("invalid_input", why("not_a_url"));
  }
}

function boundedTargetHandle(input: unknown): string {
  if (typeof input !== "string" || !TARGET_HANDLE.test(input)) {
    recoverable("invalid_input", rejectionDetail({ reason: "malformed_handle", target: typeof input === "string" ? input : undefined, instead: undefined, missing: undefined, requestId: undefined }));
  }
  return input;
}

function exactToolKeys(input: JsonObject, allowed: string[]): void {
  const keys = new Set(allowed);
  const unexpected = Object.keys(input).some((key) => !keys.has(key));
  const missing = allowed.some((key) => !Object.prototype.hasOwnProperty.call(input, key));
  if (!unexpected && !missing) return;
  // The tool's own declared keys: what it takes, and all it takes.
  recoverable("invalid_input", rejectionDetail({
    reason: unexpected ? "unexpected_input_keys" : "missing_input_keys",
    target: undefined,
    instead: allowed,
    missing: undefined,
    requestId: undefined
  }));
}

/** A refusal whose reason is the whole of what the model needs. */
function why(reason: "another_origin" | "already_at_destination" | "not_a_url") {
  return rejectionDetail({ reason, target: undefined, instead: undefined, missing: undefined, requestId: undefined });
}
