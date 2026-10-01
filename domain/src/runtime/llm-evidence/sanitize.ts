// A raw page snapshot becomes `web-llm-evidence.v2`: the value-safe,
// origin-checked packet that is the only page data an LLM ever sees.
//
// It carries every element the capture sent, in the order the capture sent it
// -- document order -- with its text and its attributes, and nothing in it is
// capped, ranked, trimmed or budgeted (t200, the user's order of 2026-09-30:
// "Remove ANY AND ALL LIMITS ON THE NUMBER OF ELEMENTS PASSED TO MODEL. DO NOT
// HIDE INFORMATION OR USE ANY RANKING ALGORITHM."). Until then the packet held
// forty elements, moved an open modal's controls to the front, cut every string
// to a field bound and popped elements until it fit a byte budget.
//
// What it still refuses to carry is a secret. A control whose signature says
// it holds one is not described (`elements.ts`), and every string it publishes
// is screened (`withheld.ts`, `location.ts`), so a token-shaped attribute or a
// secret query value reaches the model as a marker.
//
// A failure packet also says which of its opaque handles the failed action was
// aiming at. That is the one page fact Core cannot supply -- Core knows the
// attempt, the node and the definition, and nothing about the control. It is a
// handle and never a selector, so the mark is readable by the model and
// addresses nothing. When the target cannot be marked the packet says so rather
// than staying silent: `failedTargetMissing` when the action's control is not
// among the elements described (it left the page), `failedTargetUnknown` when
// the producer did not say which control the action addressed. Exactly one of
// the three is present on a failure packet, and none of them on any other. A
// failure packet also names the parameters a repair fills, `repairParameters`,
// in the domain's own words rather than the page's.
//
// Nothing is moved to the front, and what stands in front of the page is still
// said: an open dialog, a wall and what it covers are marked on the elements
// they are and cover (`layers.ts`), so a consent wall or a robot check reads as
// one wherever the page put it.
//
// No two elements of a packet read alike. Where the page repeats a control, the
// copies are given what a person would tell them apart by -- the dialog, the
// row's words, which of them from the top (`look-alikes.ts`).

import type { JsonObject } from "fluxiq/core";
import { sanitizedEvidenceElement, type WebLlmEvidenceElement } from "./elements";
import { openDialogNameOf } from "./front-layer";
import { joinWebLlmLayers, type WebLlmLayerSubject } from "./layers";
import { evidenceLocation, safeEvidenceUrl } from "./location";
import { tellWebLlmLookAlikesApart, type WebLlmLookAlikeCues } from "./look-alikes";
import { capturedTruncated, webLlmPageContext, type WebLlmPageContext } from "./page-evidence";
import { present } from "./present";
import { jsonRecord } from "./untrusted-json";
import { screenedPageText } from "./withheld";
import type { WebRepairCandidateProjection } from "./target";

/**
 * `.v2` is not cosmetic. `.v1` described every element with its `selector`, so a
 * stored `.v1` packet both leaks a browser concept to whatever reads it and has
 * a shape no current reader expects. The version is the gate that keeps one out
 * of the repair path and out of the reusable-evidence cache.
 */
export const WEB_LLM_EVIDENCE_SCHEMA_VERSION = "web-llm-evidence.v2" as const;

export type WebLlmPageEvidence = WebLlmPageContext & {
  schemaVersion: typeof WEB_LLM_EVIDENCE_SCHEMA_VERSION;
  trust: "untrusted-page-evidence";
  location: string;
  title?: string;
  /** Every element the capture sent, in document order. */
  elements: WebLlmEvidenceElement[];
  /**
   * The packet is less than the page. The packet itself leaves nothing out, so
   * this is true only when the capture says it did (`captureTruncated`).
   */
  truncated: boolean;
  /** The browser's capture left elements out before the packet saw them. */
  captureTruncated?: true;
  /** The opaque handle of the element the failed action addressed. Only on a failure packet, and never a selector. */
  failedTarget?: string;
  /** The failed action's control is not among the elements described: it left the page. */
  failedTargetMissing?: true;
  /** The producer did not say which control the failed action addressed, so the packet marks none. Not the same as the control being gone. */
  failedTargetUnknown?: true;
  /**
   * On a failure packet: each parameter a target override for the failed
   * action names in `target.handles`, with what its handle must be. Core tells
   * the model to fill one handle per parameter the evidence offers, and a
   * packet that offered none left it to guess the key
   * (`run-mu4tfxld-e78debce`). An empty map says the failed action offers
   * nothing to re-point.
   */
  repairParameters?: Record<string, string>;
  /** Every element that could fill the failed action's parameter, by opaque handle, in document order; failure packets only. */
  repairCandidates?: WebRepairCandidateProjection;
};

/**
 * The packet plus the target-handle-to-selector map behind it. The map never
 * leaves the domain: it is how an opaque `target.N` the model was given is
 * bound back to a selector across a later recapture.
 */
export type WebLlmSnapshotBinding = {
  evidence: WebLlmPageEvidence;
  /** Opaque handle to the selector that addresses it. The packet carries the keys; only this map carries the values. */
  selectors: Map<string, string>;
  /**
   * Opaque handle to the record -- row, list item, card -- its element sits in,
   * for the elements the page placed in one (`elements.ts` `recordAddress`).
   * Like the selectors it never leaves the domain: it is the half of an
   * element's address that a positional row selector cannot carry, and
   * `stable-handles.ts` keys on both.
   */
  records: Map<string, string>;
  /**
   * Opaque handle to the open shadow host chain of an element that sits inside
   * one (`elements.ts`), for those elements only. The other half of such an
   * element's address, and like the selector it never leaves the domain: a
   * handle's identity carries it (`plan-resolution/element-identity.ts`), so a
   * created Flow's click and wait look for the element in the root it was in.
   * Optional because a binding built before it existed, or by hand, has none.
   */
  shadowHosts?: Map<string, readonly string[]>;
  /**
   * The page's state digest, taken from the capture this binding was sanitized
   * from (`state-digest/snapshot-states.ts`). It is how a call reports the
   * state it found and left without another capture. Like the maps it never
   * leaves the domain inside a packet; it leaves only on the call's
   * `stateDigests`. Absent on a binding no capture produced -- a failure
   * packet, one built by hand.
   */
  stateDigest?: string;
  /**
   * The page's route state, exactly as the host's `observeRouteState` would
   * read it from the same capture (`state-digest/snapshot-states.ts`), taken at
   * the same moment as `stateDigest` and absent in the same cases. It leaves
   * only on the call's `routeState`, and only for the page the call left.
   */
  routeState?: JsonObject;
  /**
   * The captured page's own query, as key and value pairs, unscreened. The
   * packet's `location` carries the query too, but with a secret-named
   * parameter's value withheld (`./location.ts`), so it is not what the page
   * really had. Like the selectors this never leaves the domain: it is kept
   * only so a build may run a site search it performed again with other words
   * (`node-run/shown-addresses.ts`). Absent for a page with no query.
   */
  pageQuery?: ReadonlyArray<readonly [string, string]>;
};

/** How many of a page's query pairs a binding keeps. */
const MAX_PAGE_QUERY_PAIRS = 16;

export type WebLlmSanitizeOptions = {
  expectedOrigin?: string;
  /**
   * Present when this packet describes a failed action, which is what makes it
   * a failure packet rather than an observation. `selector` is the control the
   * producer said the action addressed; it stays inside this module, and what
   * leaves is the handle it maps to. Passing `{}` is the honest form of "the
   * producer did not say", and marks the packet `failedTargetUnknown`.
   * `repairParameters` is what the packet tells the model a repair fills; it is
   * the domain's own wording, never page data, and is copied as given.
   */
  failedAction?: { selector?: string; repairParameters?: Readonly<Record<string, string>> };
};

export function sanitizeWebLlmSnapshot(input: unknown, options: WebLlmSanitizeOptions = {}): WebLlmPageEvidence {
  return sanitizeWebLlmSnapshotWithBindings(input, options).evidence;
}

export function sanitizeWebLlmSnapshotWithBindings(input: unknown, options: WebLlmSanitizeOptions = {}): WebLlmSnapshotBinding {
  const snapshot = jsonRecord(input, "web DOM snapshot");
  const url = safeEvidenceUrl(snapshot.url);
  if (options.expectedOrigin !== undefined && url.origin !== options.expectedOrigin) throw new Error("web DOM snapshot escaped the expected origin");
  if (!Array.isArray(snapshot.interactiveElements)) throw new Error("web DOM snapshot elements are malformed");

  // The focused element is matched by selector rather than carried separately,
  // so focus disappears with the element it belongs to. Running it through the
  // same sanitizer is also what keeps a focused password field from being
  // announced: the sanitizer refuses it, and there is then no selector to match.
  const focusedSelector = sanitizedEvidenceElement(snapshot.focusedElement, { target: "target.focus", url })?.selector;

  const elements: WebLlmEvidenceElement[] = [];
  const selectors = new Map<string, string>();
  const records = new Map<string, string>();
  const shadowHosts = new Map<string, readonly string[]>();
  // What tells a look-alike apart, kept beside the packet and published only
  // on an element that needs it.
  const cues = new Map<string, WebLlmLookAlikeCues>();
  const dialogOf = openDialogNameOf(snapshot);
  const layerSubjects: WebLlmLayerSubject[] = [];
  // Every element, in the capture's order. Nothing is skipped but what cannot
  // be addressed or must not be described (`elements.ts`).
  for (const raw of snapshot.interactiveElements) {
    const described = sanitizedEvidenceElement(raw, { target: `target.${elements.length + 1}`, url, focusedSelector });
    if (!described) continue;
    elements.push(described.element);
    // The one place a selector is written down, and it is not the packet.
    selectors.set(described.element.target, described.selector);
    if (described.record !== undefined) records.set(described.element.target, described.record);
    if (described.shadowHosts !== undefined) shadowHosts.set(described.element.target, described.shadowHosts);
    layerSubjects.push({ element: described.element, selector: described.selector, raw });
    cues.set(described.element.target, present<WebLlmLookAlikeCues>({ within: described.within, dialog: dialogOf(raw), position: described.position }));
  }

  const childFrameIds = [...new Set(elements.map((element) => element.frameId).filter((id): id is number => id !== undefined))].sort((left, right) => left - right);
  const captureTruncated = capturedTruncated(snapshot);
  const handleOf = joinWebLlmLayers(snapshot, layerSubjects);
  const context = webLlmPageContext(snapshot, childFrameIds, handleOf);
  const evidence = present<WebLlmPageEvidence>({
    schemaVersion: WEB_LLM_EVIDENCE_SCHEMA_VERSION,
    trust: "untrusted-page-evidence",
    location: evidenceLocation(url),
    title: screenedPageText(snapshot.title),
    // The page context is carried field by field rather than spread, so a
    // packet field renamed or dropped in `page-evidence.ts` fails here instead
    // of quietly leaving the packet.
    frame: context.frame,
    loading: context.loading,
    navigation: context.navigation,
    dialogs: context.dialogs,
    blockedBy: context.blockedBy,
    selectedText: context.selectedText,
    elements,
    truncated: captureTruncated,
    captureTruncated: captureTruncated ? true : undefined,
    // Not written here: `markFailedTarget` writes exactly one of the three
    // marks, and the repair parameters where the producer gave them, and only
    // for a packet that is describing a failure. Named so the packet's key set
    // stays exhaustive.
    failedTarget: undefined,
    failedTargetMissing: undefined,
    failedTargetUnknown: undefined,
    repairParameters: undefined,
    repairCandidates: undefined
  });
  markFailedTarget(evidence, selectors, options.failedAction);
  tellWebLlmLookAlikesApart(evidence.elements, cues);
  const pageQuery = [...url.searchParams].slice(0, MAX_PAGE_QUERY_PAIRS);
  return present<WebLlmSnapshotBinding>({ evidence, selectors, records, shadowHosts, stateDigest: undefined, routeState: undefined, pageQuery: pageQuery.length > 0 ? pageQuery : undefined });
}

/**
 * Writes the failure packet's statements about the failed action -- its one
 * mark on the target, and the parameters a repair fills. Nothing is written for
 * a packet that is not describing a failure.
 */
function markFailedTarget(evidence: WebLlmPageEvidence, selectors: Map<string, string>, failedAction: WebLlmSanitizeOptions["failedAction"]): void {
  if (!failedAction) return;
  // A copy, so a producer that reuses its map cannot change a packet already issued.
  if (failedAction.repairParameters) evidence.repairParameters = { ...failedAction.repairParameters };
  if (!failedAction.selector) {
    evidence.failedTargetUnknown = true;
    return;
  }
  const handle = [...selectors.entries()].find(([, selector]) => selector === failedAction.selector)?.[0];
  if (handle === undefined) evidence.failedTargetMissing = true;
  else evidence.failedTarget = handle;
}
