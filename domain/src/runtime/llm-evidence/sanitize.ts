// A raw page snapshot becomes `web-llm-evidence.v2`: the bounded, value-free,
// origin-checked packet that is the only page data an LLM ever sees.
//
// Two things make it safe to hand to a model. Nothing that could be a secret
// survives -- no input values, no query strings, no cross-origin links, no
// control whose signature says it holds a credential. And it is bounded, by a
// budget that depends on which consumer asked: the exploration tools default
// to 6,000 bytes, the failure path to Core's 3,000-byte gate, and neither may
// exceed 12,000. Over budget, the packet is trimmed rather than refused --
// lowest-value evidence first -- and says so in `truncated`.
//
// A failure packet also says which of its opaque handles the failed action was
// aiming at. That is the one page fact Core cannot supply -- Core knows the
// attempt, the node and the definition, and nothing about the control -- and
// without it the model is shown forty elements and left to guess which one it
// was asked to repair. It is a handle and never a selector, so the mark is
// readable by the model and addresses nothing. When the target cannot be
// marked the packet says so rather than staying silent: `failedTargetMissing`
// when the action's control is not among the elements described (it left the
// page, or `budgetTruncated` says the trim cut it), `failedTargetUnknown` when
// the producer did not say which control the action addressed. Exactly one of
// the three is present on a failure packet, and none of them on any other. A
// failure packet also names the parameters a repair fills, `repairParameters`,
// in the domain's own words rather than the page's.
//
// Three limits can set `truncated`, and they are three different problems with
// three different answers: the browser's capture already dropped elements
// before the packet saw them, the packet's own element bound cut the ranked
// tail, or the byte budget forced removals. So `truncated` is only the
// summary -- "is this less than the page" -- and each limit is named beside it
// as `captureTruncated`, `elementsTruncated` and `budgetTruncated`, present
// only when they fired. A reader that just needs to know something is missing
// reads one field; a reader deciding what to do next reads which. The rule and
// the full set of limits on the evidence path are tabulated once, in
// `domain/src/recording/web-state/evidence/input.ts`.

import { sanitizedEvidenceElement, type WebLlmEvidenceElement } from "./elements";
import { frontLayerFirst } from "./front-layer";
import { evidenceByteLimit, serializedBytes, WEB_LLM_EVIDENCE_BOUNDS, WEB_LLM_EVIDENCE_BYTE_BUDGETS } from "./limits";
import { evidenceLocation, safeEvidenceUrl } from "./location";
import { capturedTruncated, evidenceElementTotal, webLlmPageContext, type WebLlmPageContext } from "./page-evidence";
import { present } from "./present";
import { recoverable } from "./tool-rejection";
import { boundedText, jsonRecord } from "./untrusted-json";
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
  elements: WebLlmEvidenceElement[];
  /** Any of the three limits below fired, so the packet is less than the page. */
  truncated: boolean;
  /** The browser's capture cut elements before the packet saw them. Narrow the capture; asking for a bigger packet will not recover them. */
  captureTruncated?: true;
  /** The capture offered more elements than the packet's own bound carries, so the ranked tail was left out. */
  elementsTruncated?: true;
  /** The byte budget forced removals. A larger budget, or a narrower page, returns them. */
  budgetTruncated?: true;
  /** The opaque handle of the element the failed action addressed. Only on a failure packet, and never a selector. */
  failedTarget?: string;
  /** The failed action's control is not among the elements described: it left the page, or, with `budgetTruncated`, the trim cut it. */
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
  /** Bounded opaque repair handles ranked from these same elements; failure packets only. */
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
};

export type WebLlmSanitizeOptions = {
  expectedOrigin?: string;
  maxEvidenceBytes?: number;
  /** Which consumer's budget applies. `failure` is both defaulted and capped at Core's gate. */
  budget?: "exploration" | "failure";
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
  const maxEvidenceBytes = budgetFor(options);
  if (!Array.isArray(snapshot.interactiveElements)) throw new Error("web DOM snapshot elements are malformed");

  // The focused element is matched by selector rather than carried separately,
  // so focus disappears with the element it belongs to. Running it through the
  // same sanitizer is also what keeps a focused password field from being
  // announced: the sanitizer refuses it, and there is then no selector to match.
  const focusedSelector = sanitizedEvidenceElement(snapshot.focusedElement, { target: "target.focus", url })?.selector;

  const elements: WebLlmEvidenceElement[] = [];
  const selectors = new Map<string, string>();
  const records = new Map<string, string>();
  // An open modal dialog's own controls first: nothing else can be pressed (`front-layer.ts`).
  for (const raw of frontLayerFirst(snapshot, snapshot.interactiveElements)) {
    if (elements.length >= WEB_LLM_EVIDENCE_BOUNDS.elements) break;
    const described = sanitizedEvidenceElement(raw, { target: `target.${elements.length + 1}`, url, focusedSelector });
    if (!described) continue;
    elements.push(described.element);
    // The one place a selector is written down, and it is not the packet.
    selectors.set(described.element.target, described.selector);
    if (described.record !== undefined) records.set(described.element.target, described.record);
  }

  const childFrameIds = [...new Set(elements.map((element) => element.frameId).filter((id): id is number => id !== undefined))].sort((left, right) => left - right);
  const elementTotal = evidenceElementTotal(snapshot, elements.length);
  const title = boundedText(snapshot.title, WEB_LLM_EVIDENCE_BOUNDS.text);
  const captureTruncated = capturedTruncated(snapshot);
  const elementsTruncated = snapshot.interactiveElements.length > WEB_LLM_EVIDENCE_BOUNDS.elements;
  const context = webLlmPageContext(snapshot, childFrameIds);
  const evidence = present<WebLlmPageEvidence>({
    schemaVersion: WEB_LLM_EVIDENCE_SCHEMA_VERSION,
    trust: "untrusted-page-evidence",
    location: evidenceLocation(url),
    title: title || undefined,
    // The page context is carried field by field rather than spread, so a
    // packet field renamed or dropped in `page-evidence.ts` fails here instead
    // of quietly leaving the packet.
    frame: context.frame,
    loading: context.loading,
    navigation: context.navigation,
    dialogs: context.dialogs,
    blockedBy: context.blockedBy,
    selectedText: context.selectedText,
    elementTotal,
    elements,
    truncated: captureTruncated || elementsTruncated,
    captureTruncated: captureTruncated ? true : undefined,
    elementsTruncated: elementsTruncated ? true : undefined,
    // Not written here: `trimToBudget` below sets it if and only if a removal
    // was needed. Mentioned so the packet's key set stays exhaustive.
    budgetTruncated: undefined,
    // Nor are these: `markFailedTarget` writes exactly one of the three marks,
    // and the repair parameters where the producer gave them, and only for a
    // packet that is describing a failure. Named for the same reason.
    failedTarget: undefined,
    failedTargetMissing: undefined,
    failedTargetUnknown: undefined,
    repairParameters: undefined,
    repairCandidates: undefined
  });
  markFailedTarget(evidence, selectors, options.failedAction);
  trimToBudget(evidence, [selectors, records], maxEvidenceBytes);
  return { evidence, selectors, records };
}

/**
 * Writes the failure packet's statements about the failed action -- its one
 * mark on the target, and the parameters a repair fills -- before the trim
 * runs, so that the bytes they cost are inside the budget rather than pushing
 * the packet over it afterwards. Nothing is written for a packet that is not
 * describing a failure.
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

function budgetFor(options: WebLlmSanitizeOptions): number {
  return options.budget === "failure"
    ? evidenceByteLimit(options.maxEvidenceBytes, WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure, WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure)
    : evidenceByteLimit(options.maxEvidenceBytes, WEB_LLM_EVIDENCE_BYTE_BUDGETS.exploration);
}

/**
 * The fields a packet can lose and still be worth reading. Ordered least useful
 * first where they are dropped: the page facts, then the repair parameters,
 * which are worth more than any page fact to a repair but less than the last
 * element, since a packet describing nothing has nothing to repair to.
 */
type DroppableEvidenceField = "selectedText" | "title" | "navigation" | "loading" | "elementTotal" | "dialogs" | "blockedBy" | "frame" | "repairParameters";

/**
 * Trim until the packet fits, lowest value first: the ranked tail of elements
 * (the capture orders them so the tail is the least useful), then the page
 * facts a reader can live without, then the last element, and only then a
 * refusal. Every removal sets `truncated` and `budgetTruncated`, because a
 * packet that silently describes less than it appears to is worse than a large
 * one -- and because "the budget cut this" is the one of the three limits a
 * consumer can answer by asking again with more room.
 *
 * The two flags are written before the size is re-measured, so the bytes they
 * cost are inside the budget rather than pushing the packet over it after the
 * last check. Neither is droppable: they describe the trimming.
 *
 * `addresses` are the binding's handle-keyed maps -- the selectors and the
 * records -- and a popped element leaves every one of them, so no map names a
 * handle the packet no longer carries.
 */
function trimToBudget(evidence: WebLlmPageEvidence, addresses: ReadonlyArray<Map<string, string>>, maxEvidenceBytes: number): void {
  const markBudgetTruncated = (): void => {
    evidence.truncated = true;
    evidence.budgetTruncated = true;
  };
  const popElement = (): void => {
    const removed = evidence.elements.pop();
    if (removed) for (const address of addresses) address.delete(removed.target);
    // A handle that named a popped element would point at nothing, so the mark
    // becomes the honest one. `budgetTruncated`, set on the same line, is what
    // separates "the trim cut it" from "it left the page".
    if (removed && evidence.failedTarget === removed.target) {
      delete evidence.failedTarget;
      evidence.failedTargetMissing = true;
    }
    markBudgetTruncated();
  };
  const droppable: DroppableEvidenceField[] = ["selectedText", "title", "navigation", "loading", "elementTotal", "dialogs", "blockedBy", "frame", "repairParameters"];
  while (serializedBytes(evidence) > maxEvidenceBytes) {
    if (evidence.elements.length > 1) {
      popElement();
      continue;
    }
    const field = droppable.shift();
    if (field !== undefined) {
      if (evidence[field] !== undefined) {
        delete evidence[field];
        markBudgetTruncated();
      }
      continue;
    }
    if (evidence.elements.length) {
      popElement();
      continue;
    }
    // Not even an empty packet of this page fits: what is left of the
    // exploration's evidence budget is spent. The model is told so, and can
    // complete from what it already holds.
    recoverable("evidence_budget_exhausted");
  }
}
