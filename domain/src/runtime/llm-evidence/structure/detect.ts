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
//
// **A target in a child frame is detected in that frame's own document**, which
// is captured alone and answers with its own address. A cross-origin frame --
// an application form served from the Lab's other loopback port -- is held to
// the origin of the document the element was shown in, which the frame merge
// published with it (`data-fluxiq-frame-url`), never to the top page's: that
// refused every such detection as a capture that escaped its origin. With no
// frame address known the top page's origin is still required, so the guard is
// never dropped. The kept binding also carries that document's path, which a
// Flow node needs to find the frame again after a reload (`./handles.ts`).
//
// **One answer can name two lists.** When the target lies outside the run the
// page answered, the page sends the one record the target belongs to beside it
// (`record`, one item). It gets a second handle, reserved after the run's and
// retained in the same scope and frame, so a plan can name either, and a Flow
// read back as a draft finds the record's item as its own list as it finds the
// run's (`../plan-resolution/own-extraction-list.ts`). A one-item proposal --
// a label/value receipt, or a lone record where nothing repeats -- needs
// nothing of its own here: it is the run, with one item (`./packet.ts`).

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
import { webAutomationUrlPath } from "../../../output-nodes";
import type { WebLlmEvidenceElement } from "../elements";
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
  let { detection, page } = await capturedDetection(context, element?.selector, element, current, target);
  // With no target the detection is page-wide and is itself the page's state.
  if (current === undefined) context.observed?.(page);
  let searchedPage = false;
  // Nothing around the target: the page is asked once more, as a whole, before
  // anything is refused (see the header). A page-wide answer names no target.
  if (!detection.ok && detection.refused === "no_repeating_run" && element !== undefined) {
    ({ detection, page } = await capturedDetection(context, undefined, element, current, target));
    searchedPage = true;
  }
  // The page sends one of four words; which of them means what to the model,
  // and what the capture says about why, is `./refusal.ts`.
  if (!detection.ok) webLlmStructureRefusal({ refused: detection.refused, target, page, searchedPage });

  const handle = context.handles.reserve();
  // The record beside the run gets a handle of its own (see the header). A
  // record left out for having only sensitive fields leaves its number unused.
  const recordHandle = detection.record === undefined ? undefined : context.handles.reserve();
  const split = splitDetectedStructure({
    detection,
    handle,
    recordHandle,
    location: page.evidence.location,
    target: searchedPage ? undefined : target,
    frameId: element?.frameId,
    frameUrlPath: element?.frameDocument?.path
  });
  if (!split) recoverable("sensitive_value");
  const scope = { projectId: request.projectId, flowId: request.flowId };
  context.handles.retain(scope, split.binding);
  if (split.recordBinding !== undefined) context.handles.retain(scope, split.recordBinding);
  return toolExecution(split.packet, false, WEB_LLM_STRUCTURE_RESULT_CODE);
}

/**
 * One capture with a detection: around `selector` when there is one, page-wide
 * otherwise, in the target's frame. Throws a `RecoverableToolRejection` for a
 * page that could not be captured or that moved away from where the target was
 * bound, and a plain error for a client that answered without a detection or
 * with a capture from an origin it was not addressed to.
 */
async function capturedDetection(
  context: WebLlmStructureDetectionContext,
  selector: string | undefined,
  bound: BoundTarget | undefined,
  current: WebLlmSnapshotBinding | undefined,
  target: string | undefined
): Promise<{ detection: WebAutomationStructureDetection; page: WebLlmSnapshotBinding }> {
  const { gateway, sessionId, request } = context;
  const frameId = bound?.frameId;
  const detectStructure: JsonObject = selector === undefined ? {} : { selector };
  const parameters: JsonObject = frameId === undefined ? { detectStructure } : { detectStructure, browserFrameId: frameId };
  const result = await gateway.executeAction(sessionId, { actionType: "web.dom.capture_snapshot", parameters, metadata: toolMetadata(request) });
  assertActive(request.signal);
  // A detection that met a robot check is the person's, as a look's is (`../capture.ts`).
  if (result.status !== "succeeded" && webActionNeedsPerson(result)) throw new RecoverableToolRejection("needs_person", undefined, undefined, true);
  if (result.status !== "succeeded") recoverable("page_unreadable");
  const payload = jsonRecord(result.payload, "web structure detection payload");
  // A frame's capture is its own document's, held to the origin that document
  // was shown with; the top page's origin when that is not known (see the header).
  const expectedOrigin = current === undefined ? undefined : (frameId === undefined ? undefined : bound?.frameDocument?.origin) ?? new URL(current.evidence.location).origin;
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
function boundTarget(returned: WebLlmSnapshotBinding | undefined, current: WebLlmSnapshotBinding, target: string): BoundTarget {
  const observed = returned ?? current;
  if (observed.evidence.location !== current.evidence.location) recoverable("target_unobserved", handleRefusal("page_moved_since_packet", target));
  const element = observedElement(observed.evidence, target);
  const selector = observed.selectors.get(target);
  if (!selector) recoverable("target_unobserved", handleRefusal("handle_not_in_packet", target));
  const stillThere = current.evidence.elements.some((candidate) => candidate.frameId === element.frameId && current.selectors.get(candidate.target) === selector);
  if (!stillThere) recoverable("target_unobserved", handleRefusal("handle_no_longer_on_page", target));
  return { selector, frameId: element.frameId, frameDocument: frameDocumentOf(element) };
}

/** A target as it was bound: its selector, its frame, and that frame's document when the element was shown in a child frame. */
type BoundTarget = { selector: string; frameId: number | undefined; frameDocument: FrameDocument | undefined };

/** The origin and the path of the document a child frame held, as the element was shown with it. */
type FrameDocument = { origin: string; path: string | undefined };

/** The attribute the frame merge publishes a child frame's element with: its frame document's URL, screened as a link is. */
const FRAME_URL_ATTRIBUTE = "data-fluxiq-frame-url";

/**
 * The http(s) document a child frame's element was shown in; nothing for the
 * top frame, or for an element published without a readable frame address.
 * The path follows the rule a recorded node's does (`output-nodes/url-path.ts`).
 */
function frameDocumentOf(element: WebLlmEvidenceElement): FrameDocument | undefined {
  if (element.frameId === undefined || element.frameId <= 0) return undefined;
  const url = element.attributes?.find(([name]) => name.toLowerCase() === FRAME_URL_ATTRIBUTE)?.[1];
  if (url === undefined || !URL.canParse(url)) return undefined;
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
  return { origin: parsed.origin, path: webAutomationUrlPath(parsed.pathname) };
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
