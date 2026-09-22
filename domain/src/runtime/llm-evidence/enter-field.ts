// Enter one model-supplied value into one observed field, then return the same
// bounded page evidence every other web exploration action returns.

import { actAndCapture, type WebLlmEvidenceGateway, type WebLlmEvidenceToolRequest } from "./capture";
import type { ResolvedWebLlmEvidenceElement } from "./elements";
import type { WebLlmSnapshotBinding } from "./sanitize";
import { recoverable, rejectionDetail } from "./tool-rejection";

export type WebFieldEntry = {
  gateway: WebLlmEvidenceGateway;
  sessionId: string;
  request: WebLlmEvidenceToolRequest;
  current: WebLlmSnapshotBinding;
  element: ResolvedWebLlmEvidenceElement;
  value: unknown;
  restamp: (binding: WebLlmSnapshotBinding) => WebLlmSnapshotBinding;
};

/** Enter text or choose a select option, inferred from the observed control. */
export async function enterWebField(input: WebFieldEntry): Promise<WebLlmSnapshotBinding> {
  if (typeof input.value !== "string") recoverable("invalid_input", reason("value_not_text"));
  const selector = input.element.selector;
  if (input.element.tag === "select") {
    return input.restamp(await actAndCapture(input.gateway, input.sessionId, input.request, "web.dom.select", { selector, value: input.value }, input.current, input.request.signal));
  }
  if (!isTextEntry(input.element)) recoverable("invalid_input", reason("not_a_text_field"));
  return input.restamp(await actAndCapture(input.gateway, input.sessionId, input.request, "web.dom.type", { selector, text: input.value }, input.current, input.request.signal));
}

/** A refusal about what the call wrote, which carries nothing from the page. */
function reason(why: "value_not_text" | "not_a_text_field") {
  return rejectionDetail({ reason: why, target: undefined, instead: undefined, missing: undefined, requestId: undefined });
}

function isTextEntry(element: ResolvedWebLlmEvidenceElement): boolean {
  if (element.tag === "textarea") return true;
  if (element.tag !== "input") return false;
  return !["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"].includes(element.inputType ?? "text");
}
