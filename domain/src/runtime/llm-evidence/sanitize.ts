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
  truncated: boolean;
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
  const evidence: WebLlmPageEvidence = {
    schemaVersion: WEB_LLM_EVIDENCE_SCHEMA_VERSION,
    trust: "untrusted-page-evidence",
    location: evidenceLocation(url),
    ...(title ? { title } : {}),
    ...webLlmPageContext(snapshot, childFrameIds),
    ...(elementTotal === undefined ? {} : { elementTotal }),
    elements,
    truncated: capturedTruncated(snapshot) || snapshot.interactiveElements.length > WEB_LLM_EVIDENCE_BOUNDS.elements
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
type DroppableEvidenceField = "selectedText" | "title" | "navigation" | "loading" | "elementTotal" | "pendingNativeDialog" | "dialogs" | "blockedBy" | "frame";

/**
 * Trim until the packet fits, lowest value first: the ranked tail of elements
 * (the capture orders them so the tail is the least useful), then the page
 * facts a reader can live without, then the last element, and only then a
 * refusal. Every removal sets `truncated`, because a packet that silently
 * describes less than it appears to is worse than a large one.
 */
function trimToBudget(evidence: WebLlmPageEvidence, selectors: Map<string, string>, maxEvidenceBytes: number): void {
  const popElement = (): void => {
    const removed = evidence.elements.pop();
    if (removed) selectors.delete(removed.target);
    evidence.truncated = true;
  };
  const droppable: DroppableEvidenceField[] = ["selectedText", "title", "navigation", "loading", "elementTotal", "pendingNativeDialog", "dialogs", "blockedBy", "frame"];
  while (serializedBytes(evidence) > maxEvidenceBytes) {
    if (evidence.elements.length > 1) {
      popElement();
      continue;
    }
    const field = droppable.shift();
    if (field !== undefined) {
      if (evidence[field] !== undefined) {
        delete evidence[field];
        evidence.truncated = true;
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
