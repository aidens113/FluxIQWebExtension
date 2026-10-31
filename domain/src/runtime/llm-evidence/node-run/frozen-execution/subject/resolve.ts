import type { JsonObject } from "fluxiq/core";
import { webRefreshTargetIdentity } from "../../../../target-reacquire/identity";
import type { WebLlmSnapshotBinding } from "../../../sanitize";
import { webNodeFrozenSameScope } from "../scope";
import type { WebNodeFrozenCall } from "../types";

/** Validate the old subject against the current page, without any handle lookup. */
export function webNodeFrozenSubject(call: WebNodeFrozenCall, page: WebLlmSnapshotBinding | undefined): { parameters: JsonObject; handle: string | undefined } | undefined {
  if (page === undefined || !webNodeFrozenSameScope(call.scope, page)) return undefined;
  if (call.subjectKind !== "element") return { parameters: call.parameters, handle: undefined };
  const provenance = page.captureProvenance!;
  const refreshed = webRefreshTargetIdentity({ parameters: call.parameters, observation: { ...provenance, page, samePlace: "yes" } });
  if (refreshed.outcome !== "found") return undefined;
  const handles = [...page.selectors].filter(([, selector]) => selector === refreshed.target.selector).map(([handle]) => handle);
  if (handles.length !== 1 || !page.evidence.elements.some((element) => element.target === handles[0] && element.hidden !== true)) return undefined;
  return { parameters: { ...call.parameters, selector: refreshed.target.selector, element: refreshed.target.element as unknown as JsonObject }, handle: handles[0] };
}
