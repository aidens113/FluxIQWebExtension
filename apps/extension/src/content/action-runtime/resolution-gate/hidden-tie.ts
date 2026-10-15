import { TARGET_SCORE_FLOOR, type CandidateSelection } from "../../identity";
import { isVisibleForResolution } from "./visible";

/**
 * A scored tie in which no contender is on show: every candidate that cleared
 * the floor -- and so every one the tie is between -- is hidden. The recorded
 * control is not on the page for an action to take, so the resolver answers
 * not found rather than ambiguous (`../resolve-target.ts`, t642).
 */
export function isHiddenTie(decided: Extract<CandidateSelection, { outcome: "ambiguous" }>): boolean {
  return !decided.ranked.some((entry) => entry.score.normalizedScore >= TARGET_SCORE_FLOOR && isVisibleForResolution(entry.element));
}
