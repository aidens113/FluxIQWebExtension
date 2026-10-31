// Enter one model-supplied value into one observed field, then return the same
// page evidence every other web exploration action returns.

import { actAndCapture, type WebLlmActionPage, type WebLlmEvidenceGateway, type WebLlmEvidenceToolRequest } from "./capture";
import { present } from "./present";
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
export async function enterWebField(input: WebFieldEntry): Promise<WebLlmActionPage> {
  if (typeof input.value !== "string") recoverable("invalid_input", reason("value_not_text"));
  const selector = input.element.selector;
  if (input.element.tag === "select") {
    const result = await actAndCapture(input.gateway, input.sessionId, input.request, "web.dom.select", { selector, value: input.value }, input.current, input.request.signal);
    return present<WebLlmActionPage>({ page: input.restamp(result.page), actionability: result.actionability });
  }
  if (!isTextEntry(input.element)) recoverable("invalid_input", reason("not_a_text_field"));
  const result = await actAndCapture(input.gateway, input.sessionId, input.request, "web.dom.type", { selector, text: input.value }, input.current, input.request.signal);
  return present<WebLlmActionPage>({ page: input.restamp(result.page), actionability: result.actionability });
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
