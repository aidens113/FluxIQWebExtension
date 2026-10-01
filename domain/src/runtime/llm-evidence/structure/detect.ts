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
// Refusals carry a code and a reason, as every tool's do (`../tool-rejection.ts`):
// a handle the model was not shown, whose element has left the page, or whose
// selector now names elements in more than one run, is `target_unobserved`; a
// page with no readable list there is `no_repeating_structure`, and which of
// the four ways that happens is decided in `./refusal.ts`; a list whose every
// field is a sensitive control is `sensitive_value`. A client that does not
// declare the capability, or that answers without a detection, is a fault
// rather than a refusal, because nothing the model does next can change it.
//
// **A target is where the page starts looking, not a condition of finding
// anything.** When the page answers a targeted call with no run around the
// target, this asks the page once more with no target and answers with the
// page's list if it has one -- the packet then names no target, so the model
// can see the list was found on the page rather than around what it named.
// Only a page with no readable list anywhere is refused. On the everything
// store's cart the model named the heading, the subtotal, the rows and the
// buttons in turn and was refused `nothing_repeats_around_target` every time,
// until the build ran out of decisions with no Flow (`run-mulum3x7-18ceeb75`,
// `docs/working/language-driven-flow-loop-plan/reports/cart-extraction.md`).
// The content script now searches outward itself; this is the same rule held
// on this side of the wire, so it holds for any client.

import type { JsonObject } from "fluxiq/core";
import { webAutomationStructureDetectionValue, type WebAutomationStructureDetection } from "../../../extraction";
import {
  assertActive,
  captureEvidence,
  toolExecution,
  toolMetadata,
  type WebLlmEvidenceGateway,
  type WebLlmEvidenceToolExecution,
  type WebLlmEvidenceToolRequest
} from "../capture";
import { canonicalWebLlmTargetHandle } from "../handle-spelling";
import { present } from "../present";
import { observedElement } from "../press";
import { sanitizeWebLlmSnapshotWithBindings, type WebLlmSanitizeOptions, type WebLlmSnapshotBinding } from "../sanitize";
import { webLlmSnapshotStates } from "../state-digest";
import { webActionNeedsPerson } from "../action-failure";
import { recoverable, RecoverableToolRejection, rejectionDetail } from "../tool-rejection";
import { jsonRecord } from "../untrusted-json";
import { WEB_LLM_STRUCTURE_RESULT_CODE } from "../vocabulary";
import type { WebLlmExtractionHandles } from "./handles";
import { splitDetectedStructure } from "./packet";
import { webLlmStructureRefusal } from "./refusal";

export type WebLlmStructureDetectionContext = {
  gateway: WebLlmEvidenceGateway;
  sessionId: string;
  request: WebLlmEvidenceToolRequest;
  /** The last packet this Flow's authoring was shown, which is what a target handle is bound through. */
  returned: WebLlmSnapshotBinding | undefined;
  handles: WebLlmExtractionHandles;
  /**
   * Told the one whole-page capture this detection read the page's state in,
   * as soon as it has it, so the caller can report that state on the result
   * or on a refusal thrown after it (`../capture.ts`, `withCallStates`). That
   * is the capture that binds the target when one was named, and otherwise
   * the page-wide detection itself; a detection in a frame reads the frame's
   * own document, which is not the page, so it is never the one. Absent, as on
   * the recovery path, nobody is told.
   */
  observed?: (page: WebLlmSnapshotBinding) => void;
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
  if (current !== undefined) context.observed?.(current);
  const element = current === undefined || target === undefined ? undefined : boundTarget(context.returned, current, target);
  let { detection, page } = await capturedDetection(context, element?.selector, element?.frameId, current, target);
  // With no target the detection is page-wide and is itself the page's state.
  if (current === undefined) context.observed?.(page);
  let searchedPage = false;
  // Nothing around the target: the page is asked once more, as a whole, before
  // anything is refused (see the header). A page-wide answer names no target.
  if (!detection.ok && detection.refused === "no_repeating_run" && element !== undefined) {
    ({ detection, page } = await capturedDetection(context, undefined, element.frameId, current, target));
    searchedPage = true;
  }
  // The page sends one of four words; which of them means what to the model,
  // and what the capture says about why, is `./refusal.ts`.
  if (!detection.ok) webLlmStructureRefusal({ refused: detection.refused, target, page, searchedPage });

  const handle = context.handles.reserve();
  const split = splitDetectedStructure({
    detection,
    handle,
    location: page.evidence.location,
    target: searchedPage ? undefined : target,
    frameId: element?.frameId
  });
  if (!split) recoverable("sensitive_value");
  context.handles.retain({ projectId: request.projectId, flowId: request.flowId }, split.binding);
  return toolExecution(split.packet, false, WEB_LLM_STRUCTURE_RESULT_CODE);
}

/**
 * One capture with a detection: around `selector` when there is one, page-wide
 * otherwise, in the target's frame. Throws a `RecoverableToolRejection` for a
 * page that could not be captured or that moved away from where the target was
 * bound, and a plain error for a client that answered without a detection.
 */
async function capturedDetection(
  context: WebLlmStructureDetectionContext,
  selector: string | undefined,
  frameId: number | undefined,
  current: WebLlmSnapshotBinding | undefined,
  target: string | undefined
): Promise<{ detection: WebAutomationStructureDetection; page: WebLlmSnapshotBinding }> {
  const { gateway, sessionId, request } = context;
  const detectStructure: JsonObject = selector === undefined ? {} : { selector };
  const parameters: JsonObject = frameId === undefined ? { detectStructure } : { detectStructure, browserFrameId: frameId };
  const result = await gateway.executeAction(sessionId, { actionType: "web.dom.capture_snapshot", parameters, metadata: toolMetadata(request) });
  assertActive(request.signal);
  // A detection that met a robot check is the person's, as a look's is (`../capture.ts`).
  if (result.status !== "succeeded" && webActionNeedsPerson(result)) throw new RecoverableToolRejection("needs_person", undefined, undefined, true);
  if (result.status !== "succeeded") recoverable("page_unreadable");
  const payload = jsonRecord(result.payload, "web structure detection payload");
  const expectedOrigin = current === undefined ? undefined : new URL(current.evidence.location).origin;
  const sanitized = sanitizeWebLlmSnapshotWithBindings(payload.snapshot, present<WebLlmSanitizeOptions>({
    expectedOrigin,
    failedAction: undefined
  }));
  // Digested and projected only where the capture is of the page: a frame's
  // detection describes the frame's own document (`observed` above), which is
  // neither the page's state nor the route state `observeRouteState` reads.
  const states = frameId === undefined ? webLlmSnapshotStates(sanitized) : undefined;
  const page = present<WebLlmSnapshotBinding>({
    evidence: sanitized.evidence,
    selectors: sanitized.selectors,
    records: sanitized.records,
    shadowHosts: sanitized.shadowHosts,
    stateDigest: states?.stateDigest,
    routeState: states?.routeState,
    pageQuery: sanitized.pageQuery
  });
  // A top-frame detection must describe the page the target was bound on; a
  // frame's own document has its own location, and its origin is held above.
  if (current !== undefined && frameId === undefined && page.evidence.location !== current.evidence.location) recoverable("target_unobserved", handleRefusal("page_moved_since_packet", target));
  const detection = webAutomationStructureDetectionValue(payload.structure);
  if (detection === undefined) throw new Error("the web client answered the capture without a structure detection");
  return { detection, page };
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
  if (observed.evidence.location !== current.evidence.location) recoverable("target_unobserved", handleRefusal("page_moved_since_packet", target));
  const element = observedElement(observed.evidence, target);
  const selector = observed.selectors.get(target);
  if (!selector) recoverable("target_unobserved", handleRefusal("handle_not_in_packet", target));
  const stillThere = current.evidence.elements.some((candidate) => candidate.frameId === element.frameId && current.selectors.get(candidate.target) === selector);
  if (!stillThere) recoverable("target_unobserved", handleRefusal("handle_no_longer_on_page", target));
  return { selector, frameId: element.frameId };
}

/** Which of the ways a handle stops naming one control happened here, and the handle it was. */
function handleRefusal(reason: "handle_not_in_packet" | "page_moved_since_packet" | "handle_no_longer_on_page", target: string | undefined) {
  return rejectionDetail({ reason, target, instead: undefined, missing: undefined, requestId: undefined });
}

/** `{}` or `{ target }`, and nothing else; the target in the packets' spelling, so `target.N` is read as `tN`. */
function requestedTarget(value: JsonObject): string | undefined {
  const keys = Object.keys(value);
  if (keys.some((key) => key !== "target")) {
    recoverable("invalid_input", rejectionDetail({ reason: "unexpected_input_keys", target: undefined, instead: ["target"], missing: undefined, requestId: undefined }));
  }
  if (!keys.includes("target")) return undefined;
  const target = canonicalWebLlmTargetHandle(value.target);
  if (target === undefined) {
    return recoverable("invalid_input", rejectionDetail({ reason: "malformed_handle", target: typeof value.target === "string" ? value.target : undefined, instead: undefined, missing: undefined, requestId: undefined }));
  }
  return target;
}
