// `web.detect_repeating_structure`: find the list an authoring model wants to
// extract, without showing the model a selector or a value.
//
// The model names an element it was shown -- by the opaque handle an inspect
// gave it -- or nothing, for the page's largest readable list. The page runs
// the picker's own inference there (`web.dom.capture_snapshot` with
// `detectStructure`) and answers with a proposal. This splits the proposal
// (`packet.ts`): the model gets an extraction handle, field keys and labels,
// coverage, the item count and how the list continues; the handle store gets
// the selectors.
//
// It only observes. It clicks, types and scrolls nothing, so it is declared
// `observe` and reports no effect. Core refuses a second identical request
// before the page changes, so it needs no repeat policy of its own, and a
// second target is a different request.
//
// Refusals are bare codes, as every tool's are: a handle the model was not
// shown, whose element has left the page, or whose selector now names elements
// in more than one run, is `target_unobserved`; a page
// with no readable list there is `no_repeating_structure`; a list whose every
// field is a sensitive control is `sensitive_value`. A client that does not
// declare the capability, or that answers without a detection, is a fault
// rather than a refusal, because nothing the model does next can change it.

import type { JsonObject } from "fluxiq/core";
import { webAutomationStructureDetectionValue, type WebAutomationStructureDetectionRefusal } from "../../../extraction";
import {
  assertActive,
  captureEvidence,
  toolExecution,
  toolMetadata,
  type WebLlmEvidenceGateway,
  type WebLlmEvidenceToolExecution,
  type WebLlmEvidenceToolRequest
} from "../capture";
import { present } from "../present";
import { observedElement } from "../press";
import { sanitizeWebLlmSnapshotWithBindings, type WebLlmSanitizeOptions, type WebLlmSnapshotBinding } from "../sanitize";
import { WEB_LLM_TARGET_HANDLE_PATTERN } from "../stable-handles";
import { recoverable, type WebLlmToolRejectionCode } from "../tool-rejection";
import { jsonRecord } from "../untrusted-json";
import { WEB_LLM_STRUCTURE_RESULT_CODE } from "../vocabulary";
import type { WebLlmExtractionHandles } from "./handles";
import { splitDetectedStructure } from "./packet";

const TARGET_HANDLE = new RegExp(WEB_LLM_TARGET_HANDLE_PATTERN, "u");

/** What the page's refusal means to the model. */
const REFUSAL_CODES = {
  target_not_found: "target_unobserved",
  ambiguous_target: "target_unobserved",
  no_repeating_run: "no_repeating_structure",
  sensitive_region: "sensitive_value"
} as const satisfies Record<WebAutomationStructureDetectionRefusal, WebLlmToolRejectionCode>;

export type WebLlmStructureDetectionContext = {
  gateway: WebLlmEvidenceGateway;
  sessionId: string;
  request: WebLlmEvidenceToolRequest;
  /** The last packet this Flow's authoring was shown, which is what a target handle is bound through. */
  returned: WebLlmSnapshotBinding | undefined;
  handles: WebLlmExtractionHandles;
};

/**
 * Detect, split and retain. Throws a `RecoverableToolRejection` for anything
 * the model can answer differently, and a plain error for a fault; the caller
 * turns the first into a result, as it does for every tool.
 */
export async function detectRepeatingStructure(context: WebLlmStructureDetectionContext): Promise<WebLlmEvidenceToolExecution> {
  const { gateway, sessionId, request } = context;
  const target = requestedTarget(request.value);
  if (!(gateway.structureDetectionSessionIds?.() ?? []).includes(sessionId)) {
    throw new Error("the connected web client does not declare repeating-structure detection");
  }

  const current = target === undefined ? undefined : await captureEvidence(gateway, sessionId, request, request.signal);
  const element = current === undefined || target === undefined ? undefined : boundTarget(context.returned, current, target);
  const detectStructure: JsonObject = element === undefined ? {} : { selector: element.selector };
  const parameters: JsonObject = element?.frameId === undefined ? { detectStructure } : { detectStructure, browserFrameId: element.frameId };
  const result = await gateway.executeAction(sessionId, { actionType: "web.dom.capture_snapshot", parameters, metadata: toolMetadata(request) });
  assertActive(request.signal);
  if (result.status !== "succeeded") recoverable("page_unreadable");
  const payload = jsonRecord(result.payload, "web structure detection payload");
  const expectedOrigin = current === undefined ? undefined : new URL(current.evidence.location).origin;
  const page = sanitizeWebLlmSnapshotWithBindings(payload.snapshot, present<WebLlmSanitizeOptions>({
    budget: "exploration",
    maxEvidenceBytes: undefined,
    expectedOrigin,
    failedAction: undefined
  }));
  // A top-frame detection must describe the page the target was bound on; a
  // frame's own document has its own location, and its origin is held above.
  if (current !== undefined && element?.frameId === undefined && page.evidence.location !== current.evidence.location) recoverable("target_unobserved");

  const detection = webAutomationStructureDetectionValue(payload.structure);
  if (detection === undefined) throw new Error("the web client answered the capture without a structure detection");
  if (!detection.ok) recoverable(REFUSAL_CODES[detection.refused]);

  const handle = context.handles.reserve();
  const split = splitDetectedStructure({
    detection,
    handle,
    location: page.evidence.location,
    target,
    frameId: element?.frameId,
    maxEvidenceBytes: request.maxEvidenceBytes
  });
  if (!split) recoverable("sensitive_value");
  context.handles.retain({ projectId: request.projectId, flowId: request.flowId }, split.binding);
  return toolExecution(split.packet, false, WEB_LLM_STRUCTURE_RESULT_CODE);
}

/**
 * The selector and frame a target handle was issued for, still on the page.
 *
 * Reveal binds a handle more strictly -- the selector must name exactly one
 * element now -- because it clicks. This only reads, and a snapshot's
 * selectors are not always unique (every product card's link can share one),
 * so here the selector must still be on the same page, in the same frame, and
 * the page itself refuses it as `ambiguous_target` when its matches are not
 * all in the one run.
 */
function boundTarget(returned: WebLlmSnapshotBinding | undefined, current: WebLlmSnapshotBinding, target: string): { selector: string; frameId: number | undefined } {
  const observed = returned ?? current;
  if (observed.evidence.location !== current.evidence.location) recoverable("target_unobserved");
  const element = observedElement(observed.evidence, target);
  const selector = observed.selectors.get(target);
  if (!selector) recoverable("target_unobserved");
  const stillThere = current.evidence.elements.some((candidate) => candidate.frameId === element.frameId && current.selectors.get(candidate.target) === selector);
  if (!stillThere) recoverable("target_unobserved");
  return { selector, frameId: element.frameId };
}

/** `{}` or `{ target }`, and nothing else. */
function requestedTarget(value: JsonObject): string | undefined {
  const keys = Object.keys(value);
  if (keys.some((key) => key !== "target")) recoverable("invalid_input");
  if (!keys.includes("target")) return undefined;
  const target = value.target;
  if (typeof target !== "string" || !TARGET_HANDLE.test(target)) recoverable("invalid_input");
  return target;
}
