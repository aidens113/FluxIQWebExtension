import type { JsonObject } from "fluxiq/core";
import type { WebAutomationElementFingerprint } from "../../../actions/types";
import { webReacquireElement } from "../element-match";
import { isJsonRecord } from "../../llm-evidence/untrusted-json";
import { webTargetCandidates } from "./candidates";
import type { WebTargetObservation } from "./observation";
import type { WebTargetIdentityRefreshResult } from "./refresh-result";
import { webTargetReplacement } from "./replacement";

/** Shared native/authoring identity match; no I/O, retries, Flow writes or authority changes. */
export function webRefreshTargetIdentity(input: { parameters: JsonObject; observation: WebTargetObservation }): WebTargetIdentityRefreshResult {
  const { parameters, observation } = input;
  const stale = isJsonRecord(parameters.element) ? parameters.element : undefined;
  if (stale === undefined) return { outcome: "unavailable", reason: "unsupported_target" };
  const context = isJsonRecord(stale.context) ? stale.context : undefined;
  const record = isJsonRecord(context?.record) ? context.record : undefined;
  if (Array.isArray(record?.values) && record.values.length > 0) return { outcome: "unavailable", reason: "unsupported_target" };
  if (observation.samePlace !== "yes") return { outcome: "unavailable", reason: "place_unproved" };
  if (observation.coverage !== "complete" || observation.includesHidden !== true) return { outcome: "unavailable", reason: "observation_incomplete" };
  const frame = observation.scope.browserFrameId;
  if (frame === undefined || observation.page.evidence.elements.some((element) => observation.scope.kind === "single-frame"
    && element.frameId !== undefined && element.frameId !== frame)) return { outcome: "unavailable", reason: "observation_incomplete" };
  if (observation.page.evidence.elements.some((element) => !observation.page.selectors.has(element.target))) return { outcome: "unavailable", reason: "observation_incomplete" };
  const candidates = webTargetCandidates(observation);
  const answer = webReacquireElement({ stale, candidates: candidates.map((candidate) => candidate.element as unknown as JsonObject) });
  if (answer.outcome === "unmatched") return { outcome: "unmatched", reason: answer.reason === "unidentifiable" ? "unidentifiable" : "ambiguous" };
  if (answer.outcome === "gone") return { outcome: "gone", coverage: "complete" };
  const fresh = candidates.find((candidate) => candidate.element === answer.value);
  if (fresh === undefined) return { outcome: "unavailable", reason: "observation_unavailable" };
  if (fresh.hidden) return { outcome: "unmatched", reason: "ambiguous" };
  return { outcome: "found", target: webTargetReplacement(fresh, stale as WebAutomationElementFingerprint) };
}
