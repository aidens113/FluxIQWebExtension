// Which observed element the reveal tool may click, and how an opaque target
// handle the model was given is bound back to a live element.
//
// Reveal exists so a model can uncover page structure it needs to author a
// Flow -- a disclosure, a tab, a menu item -- and nothing else. It is the one
// tool that changes the page, so the safety test is deliberately narrow and
// stated as an allowlist: anything that is not recognisably a disclosure or a
// view switch is refused, and anything whose wording suggests it commits,
// pays, sends or deletes is refused even when it is.

import type { ResolvedWebLlmEvidenceElement, WebLlmEvidenceElement } from "./elements";
import type { WebLlmPageEvidence, WebLlmSnapshotBinding } from "./sanitize";
import { recoverable } from "./tool-rejection";

const COMMITTING_ACTION_WORDS = /\b(?:submit|purchase|buy|pay|checkout|order|delete|remove|destroy|unsubscribe|confirm|send|publish)\b/iu;

export function safeRevealElement(element: ResolvedWebLlmEvidenceElement): boolean {
  const identity = [element.selector, element.name, element.text].filter(Boolean).join(" ");
  if (COMMITTING_ACTION_WORDS.test(identity)) return false;
  if (element.revealKind === "view") return element.role === "tab" || element.role === "menuitem" || element.role === "treeitem";
  if (element.revealKind !== "disclosure") return false;
  if (element.tag === "summary") return true;
  if (element.controlType === "submit" || element.inputType === "submit") return false;
  return element.tag === "button" ||
    element.role === "button" ||
    (element.tag === "input" && (element.controlType === "button" || element.inputType === "button"));
}

/** The one element a handle names, or a refusal: a handle that names none or several was never observed. */
export function observedElement(evidence: WebLlmPageEvidence, target: string): WebLlmEvidenceElement {
  const matches = evidence.elements.filter((element) => element.target === target);
  if (matches.length !== 1) recoverable("target_unobserved");
  return matches[0]!;
}

/**
 * The element in the current page that the handle the model was given refers
 * to. Handles are positional, so a recapture that reranks the page would move
 * them; the binding goes through the selector recorded when the handle was
 * issued, and the whole call is refused if the page has moved on or the
 * selector no longer names exactly one element.
 */
export function currentElementForReturnedTarget(
  returned: WebLlmSnapshotBinding | undefined,
  current: WebLlmSnapshotBinding,
  target: string
): ResolvedWebLlmEvidenceElement {
  const observedSnapshot = returned ?? current;
  if (observedSnapshot.evidence.location !== current.evidence.location) recoverable("target_unobserved");
  observedElement(observedSnapshot.evidence, target);
  const selector = observedSnapshot.selectors.get(target);
  if (!selector) recoverable("target_unobserved");
  const matches = current.evidence.elements.filter((element) => current.selectors.get(element.target) === selector);
  if (matches.length !== 1) recoverable("target_unobserved");
  return { ...matches[0]!, selector };
}
