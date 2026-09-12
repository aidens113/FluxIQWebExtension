// A raw page snapshot becomes `web-llm-evidence.v1`: the bounded, value-free,
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
import { evidenceByteLimit, serializedBytes, WEB_LLM_EVIDENCE_BOUNDS, WEB_LLM_EVIDENCE_BYTE_BUDGETS } from "./limits";
import { evidenceLocation, safeEvidenceUrl } from "./location";
import { capturedTruncated, evidenceElementTotal, webLlmPageContext, type WebLlmPageContext } from "./page-evidence";
import { boundedText, jsonRecord } from "./untrusted-json";

export const WEB_LLM_EVIDENCE_SCHEMA_VERSION = "web-llm-evidence.v1" as const;

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
};

/**
 * The packet plus the target-handle-to-selector map behind it. The map never
 * leaves the domain: it is how an opaque `target.N` the model was given is
 * bound back to a selector across a later recapture.
 */
export type WebLlmSnapshotBinding = {
  evidence: WebLlmPageEvidence;
  selectors: Map<string, string>;
};

export type WebLlmSanitizeOptions = {
  expectedOrigin?: string;
  maxEvidenceBytes?: number;
  /** Which consumer's budget applies. `failure` is both defaulted and capped at Core's gate. */
  budget?: "exploration" | "failure";
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
  for (const raw of snapshot.interactiveElements) {
    if (elements.length >= WEB_LLM_EVIDENCE_BOUNDS.elements) break;
    const element = sanitizedEvidenceElement(raw, { target: `target.${elements.length + 1}`, url, focusedSelector });
    if (!element) continue;
    elements.push(element);
    selectors.set(element.target, element.selector);
  }

  const childFrameIds = [...new Set(elements.map((element) => element.frameId).filter((id): id is number => id !== undefined))].sort((left, right) => left - right);
  const elementTotal = evidenceElementTotal(snapshot, elements.length);
  const title = boundedText(snapshot.title, WEB_LLM_EVIDENCE_BOUNDS.text);
  const captureTruncated = capturedTruncated(snapshot);
  const elementsTruncated = snapshot.interactiveElements.length > WEB_LLM_EVIDENCE_BOUNDS.elements;
  const evidence: WebLlmPageEvidence = {
    schemaVersion: WEB_LLM_EVIDENCE_SCHEMA_VERSION,
    trust: "untrusted-page-evidence",
    location: evidenceLocation(url),
    ...(title ? { title } : {}),
    ...webLlmPageContext(snapshot, childFrameIds),
    ...(elementTotal === undefined ? {} : { elementTotal }),
    elements,
    truncated: captureTruncated || elementsTruncated,
    ...(captureTruncated ? { captureTruncated: true as const } : {}),
    ...(elementsTruncated ? { elementsTruncated: true as const } : {})
  };
  trimToBudget(evidence, selectors, maxEvidenceBytes);
  return { evidence, selectors };
}

function budgetFor(options: WebLlmSanitizeOptions): number {
  return options.budget === "failure"
    ? evidenceByteLimit(options.maxEvidenceBytes, WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure, WEB_LLM_EVIDENCE_BYTE_BUDGETS.failure)
    : evidenceByteLimit(options.maxEvidenceBytes, WEB_LLM_EVIDENCE_BYTE_BUDGETS.exploration);
}

/** The page facts a packet can lose and still be worth reading. Ordered least useful first where they are dropped. */
type DroppableEvidenceField = "selectedText" | "title" | "navigation" | "loading" | "elementTotal" | "dialogs" | "blockedBy" | "frame";

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
 */
function trimToBudget(evidence: WebLlmPageEvidence, selectors: Map<string, string>, maxEvidenceBytes: number): void {
  const markBudgetTruncated = (): void => {
    evidence.truncated = true;
    evidence.budgetTruncated = true;
  };
  const popElement = (): void => {
    const removed = evidence.elements.pop();
    if (removed) selectors.delete(removed.target);
    markBudgetTruncated();
  };
  const droppable: DroppableEvidenceField[] = ["selectedText", "title", "navigation", "loading", "elementTotal", "dialogs", "blockedBy", "frame"];
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
    throw new Error("web DOM snapshot exceeds the evidence byte limit");
  }
}
