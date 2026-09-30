// A deterministic index over the elements already present in a failure packet
// that could fill the failed action's parameter. It adds no browser address or
// page text: each row is only an opaque handle and closed compatibility words.
//
// Every compatible element is listed, in the packet's order -- document order
// -- and nothing is scored (t200). Until 2026-09-30 the rows were scored on
// focus, change, recency and placement, cut to eight and fitted to a byte
// budget, so the element a repair needed could be the ninth and never be
// offered.

import { elementFillsRepairableParameter, webFailedActionDefinitionId, webRepairableParameters, type WebFailedActionIdentity, type WebRepairableParameterRole } from "../repairable-parameters";
import type { WebLlmEvidenceElement } from "../elements";
import { present } from "../present";

const ROLES = ["fillable", "selectable", "clickable", "keyable", "observable"] as const satisfies readonly WebRepairableParameterRole[];

export type WebRepairCandidateMatch = "compatible" | "action_unknown";
export type WebRepairCandidateRefusal = "action_not_repairable" | "incompatible";

export type WebRepairCandidateProjection = {
  schemaVersion: "web-repair-candidates.v2";
  status: "listed" | "no_candidates" | "action_not_repairable";
  action: "known" | "recorded_action_unknown" | "not_repairable";
  parameter: "element";
  role?: WebRepairableParameterRole;
  candidates: Array<{
    target: string;
    match: WebRepairCandidateMatch;
    roles?: WebRepairableParameterRole[];
  }>;
  refusals: Array<{ category: WebRepairCandidateRefusal; count: number }>;
};

/**
 * List the packet's existing handles that could fill the failed action's one
 * element parameter. A recorded policy action does not tell failure capture
 * which web verb it dispatched, so those rows are marked `action_unknown` and
 * carry the roles they can satisfy instead of pretending one role was known.
 * The patch request does know the verb and can select from these closed
 * categories without asking the page to describe itself again.
 */
export function projectWebRepairCandidates(
  elements: readonly WebLlmEvidenceElement[],
  failedAction: WebFailedActionIdentity
): WebRepairCandidateProjection {
  const definitionId = webFailedActionDefinitionId(failedAction);
  const recordedActionUnknown = failedAction.definitionId === "builtin.policy.action" && failedAction.outputId === undefined;
  const declared = definitionId === undefined ? [] : webRepairableParameters(definitionId);
  const role = declared.length === 1 ? declared[0]!.role : undefined;
  if (!recordedActionUnknown && role === undefined) {
    return {
      schemaVersion: "web-repair-candidates.v2", status: "action_not_repairable", action: "not_repairable", parameter: "element",
      candidates: [], refusals: [{ category: "action_not_repairable", count: 1 }]
    };
  }

  const compatible = elements.map((element) => ({ element, roles: candidateRoles(element) }))
    .filter((item) => recordedActionUnknown ? item.roles.some((candidate) => candidate !== "observable") : item.roles.includes(role!));
  const incompatible = elements.length - compatible.length;
  return present<WebRepairCandidateProjection>({
    schemaVersion: "web-repair-candidates.v2",
    status: compatible.length ? "listed" : "no_candidates",
    action: recordedActionUnknown ? "recorded_action_unknown" : "known",
    parameter: "element",
    role,
    candidates: compatible.map((item) => present<WebRepairCandidateProjection["candidates"][number]>({
      target: item.element.target,
      match: recordedActionUnknown ? "action_unknown" : "compatible",
      roles: recordedActionUnknown ? item.roles : undefined
    })),
    refusals: incompatible ? [{ category: "incompatible", count: incompatible }] : []
  });
}

function candidateRoles(element: WebLlmEvidenceElement): WebRepairableParameterRole[] {
  return ROLES.filter((role) => elementFillsRepairableParameter(element, role));
}
