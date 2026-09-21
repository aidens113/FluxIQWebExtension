// A bounded, deterministic index over the semantic elements already present in
// a failure packet. It adds no browser address or page text: each row is only
// an opaque handle, closed compatibility words, and its position in this array.

import { elementFillsRepairableParameter, webFailedActionDefinitionId, webRepairableParameters, type WebFailedActionIdentity, type WebRepairableParameterRole } from "../repairable-parameters";
import { serializedBytes } from "../limits";
import type { WebLlmEvidenceElement } from "../elements";
import { present } from "../present";

export const WEB_REPAIR_CANDIDATE_LIMIT = 8;

const ROLES = ["fillable", "selectable", "clickable", "keyable", "observable"] as const satisfies readonly WebRepairableParameterRole[];

export type WebRepairCandidateMatch = "compatible" | "action_unknown";
export type WebRepairCandidateRefusal = "action_not_repairable" | "incompatible" | "limit";

export type WebRepairCandidateProjection = {
  schemaVersion: "web-repair-candidates.v1";
  status: "ranked" | "no_candidates" | "action_not_repairable";
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
 * Rank only the packet's existing handles. A recorded policy action does not
 * tell failure capture which web verb it dispatched, so those rows are marked
 * `action_unknown` and carry the roles they can satisfy instead of pretending
 * one role was known. The patch request does know the verb and can select from
 * these closed categories without asking the page to describe itself again.
 */
export function projectWebRepairCandidates(
  elements: readonly WebLlmEvidenceElement[],
  failedAction: WebFailedActionIdentity,
  maxBytes: number
): WebRepairCandidateProjection | undefined {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) return undefined;
  const definitionId = webFailedActionDefinitionId(failedAction);
  const recordedActionUnknown = failedAction.definitionId === "builtin.policy.action" && failedAction.outputId === undefined;
  const declared = definitionId === undefined ? [] : webRepairableParameters(definitionId);
  const role = declared.length === 1 ? declared[0]!.role : undefined;
  if (!recordedActionUnknown && role === undefined) {
    return fit({
      schemaVersion: "web-repair-candidates.v1", status: "action_not_repairable", action: "not_repairable", parameter: "element",
      candidates: [], refusals: [{ category: "action_not_repairable", count: 1 }]
    }, maxBytes);
  }

  const ranked = elements.map((element, index) => ({ element, index, roles: candidateRoles(element), score: candidateScore(element) }))
    .filter(item => recordedActionUnknown ? item.roles.some(candidate => candidate !== "observable") : item.roles.includes(role!))
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const incompatible = elements.length - ranked.length;
  const chosen = ranked.slice(0, WEB_REPAIR_CANDIDATE_LIMIT);
  const limited = ranked.length - chosen.length;
  const projection = present<WebRepairCandidateProjection>({
    schemaVersion: "web-repair-candidates.v1",
    status: chosen.length ? "ranked" : "no_candidates",
    action: recordedActionUnknown ? "recorded_action_unknown" : "known",
    parameter: "element",
    role,
    candidates: chosen.map(item => present<WebRepairCandidateProjection["candidates"][number]>({
      target: item.element.target,
      match: recordedActionUnknown ? "action_unknown" : "compatible",
      roles: recordedActionUnknown ? item.roles : undefined
    })),
    refusals: [
      ...(incompatible ? [{ category: "incompatible" as const, count: incompatible }] : []),
      ...(limited ? [{ category: "limit" as const, count: limited }] : [])
    ]
  });
  return fit(projection, maxBytes);
}
function candidateRoles(element: WebLlmEvidenceElement): WebRepairableParameterRole[] {
  return ROLES.filter(role => elementFillsRepairableParameter(element, role));
}

/** Semantic state first; packet order is the stable final tie-breaker. */
function candidateScore(element: WebLlmEvidenceElement): number {
  return (element.focused ? 32 : 0)
    + (element.changed ? 16 : 0)
    + (element.recent ? 8 : 0)
    + (element.form ? 4 : 0)
    + (element.heading ? 2 : 0)
    + (element.landmark ? 1 : 0);
}

/** Remove the lowest-ranked rows until the whole closed projection fits. */
function fit(projection: WebRepairCandidateProjection, maxBytes: number): WebRepairCandidateProjection | undefined {
  let candidates = [...projection.candidates];
  let limitCount = projection.refusals.find(item => item.category === "limit")?.count ?? 0;
  while (true) {
    const refusals = projection.refusals.filter(item => item.category !== "limit");
    if (limitCount) refusals.push({ category: "limit", count: limitCount });
    const fitted: WebRepairCandidateProjection = { ...projection, status: candidates.length ? projection.status : projection.status === "action_not_repairable" ? "action_not_repairable" : "no_candidates", candidates, refusals };
    if (serializedBytes(fitted) <= maxBytes) return fitted;
    if (!candidates.length) return undefined;
    candidates = candidates.slice(0, -1);
    limitCount += 1;
  }
}
