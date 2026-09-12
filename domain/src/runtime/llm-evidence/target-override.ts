// Whether a target the model proposes for a failed action is one it actually
// saw, and one the action could work on.
//
// The check is deliberately closed over the packet: a selector is matched only
// against the bounded sanitized evidence already supplied to the model, never
// against the live page. A model that invents a selector, or names one it was
// never shown, gets `absent` or `resolved` to the single compatible element --
// it never gets to steer the browser at something nobody observed.

import { actionableEvidenceElement, safeFillTag, type WebLlmEvidenceElement } from "./elements";
import type { WebLlmPageEvidence } from "./sanitize";
import type {
  AutomationStudioRuntimeTargetOverrideEvidenceValidation,
  AutomationStudioRuntimeTargetOverrideFailedAction
} from "fluxiq/automation-studio";

/** Match a proposed selector and action semantics only against the bounded sanitized packet already supplied to the LLM. */
export function validateWebRuntimeTargetOverrideEvidence(
  evidence: WebLlmPageEvidence,
  target: { selector: string },
  failedAction: AutomationStudioRuntimeTargetOverrideFailedAction
): AutomationStudioRuntimeTargetOverrideEvidenceValidation {
  const matches = evidence.elements.filter((element) => element.selector === target.selector);
  if (matches.length > 1) return { status: "ambiguous" };
  if (matches.length === 1 && targetCompatibleWithFailedAction(matches[0]!, failedAction.definitionId)) return { status: "matched" };
  const compatible = evidence.elements.filter((element) => targetCompatibleWithFailedAction(element, failedAction.definitionId));
  if (compatible.length === 0) return { status: "absent" };
  if (compatible.length > 1) return { status: "ambiguous" };
  const resolved = compatible[0]!;
  return evidence.elements.filter((element) => element.selector === resolved.selector).length === 1
    ? { status: "resolved", target: { selector: resolved.selector } }
    : { status: "ambiguous" };
}

/** Whether the failed action's verb is one this element could carry out. */
function targetCompatibleWithFailedAction(element: WebLlmEvidenceElement, definitionId: string): boolean {
  if (definitionId === "web.output.dom-type" || definitionId === "web.output.dom-clear") return safeFillTag(element.tag, element.inputType);
  if (definitionId === "web.output.dom-select") return element.tag === "select";
  if (definitionId === "web.output.dom-click") return actionableEvidenceElement(element);
  if (definitionId === "web.output.dom-keypress") return safeFillTag(element.tag, element.inputType) || element.tag === "select" || actionableEvidenceElement(element);
  return definitionId === "web.output.dom-wait_for_selector" || definitionId === "web.output.dom-extract";
}
