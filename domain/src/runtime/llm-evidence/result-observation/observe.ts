// A result check's fresh, passive page: includes non-rendered state while
// retaining no handles, selectors, action targets or reusable bindings.
import type { AutomationStudioActionPermissionCheck } from "fluxiq/automation";
import type { JsonObject } from "fluxiq/core";
import type { WebLlmEvidenceToolRequest } from "../capture";
import type { WebLlmSnapshotBinding } from "../sanitize";
import { publishedWebLlmPage, type WebLlmPageLine } from "../page-view";
import { boundedIdentifier } from "../untrusted-json";

type ResultRequest = Pick<WebLlmEvidenceToolRequest, "projectId" | "flowId" | "callId" | "signal"> & { permission: AutomationStudioActionPermissionCheck };

export async function observeWebLlmResult(capture: (request: ResultRequest) => Promise<WebLlmSnapshotBinding>, input: ResultRequest): Promise<JsonObject> {
  input.signal?.throwIfAborted();
  boundedIdentifier(input.projectId, "projectId");
  boundedIdentifier(input.flowId, "flowId");
  boundedIdentifier(input.callId, "callId");
  const captured = await capture(input);
  input.signal?.throwIfAborted();
  // No restamp, retain, shown, target or extraction store is reached. Selector
  // maps made by sanitizing this one capture are discarded with the capture.
  const published = publishedWebLlmPage(captured.evidence);
  // The ordinary page publisher intentionally includes rendered lines only.
  // Hidden state is a separate passive projection: no targets, locators,
  // attributes or action capabilities escape from its temporary capture.
  const hidden = captured.evidence.elements.filter((element) => element.hidden === true).map((element) => ({
    hidden: true,
    tag: element.tag,
    text: element.text ?? element.name ?? element.label,
    value: element.value,
    checked: element.checked,
    selectedValue: element.selectedValue
  }));
  // Its lines follow the view as extra lines (`../page-view/keyed-line.ts`):
  // shown with this result, never part of a base a later view is compared with.
  const passive: WebLlmPageLine[] = hidden.length === 0 ? [] : [
    { key: "PASSIVE-", text: "", extra: true },
    { key: "PASSIVE", text: "PASSIVE NON-RENDERED STATE", extra: true },
    ...hidden.map((row, index) => ({ key: `PASSIVE.${index + 1}`, text: JSON.stringify(row), extra: true as const }))
  ];
  return { ...published, pageView: { ...published.pageView, lines: [...published.pageView.lines, ...passive] } } as unknown as JsonObject;
}
