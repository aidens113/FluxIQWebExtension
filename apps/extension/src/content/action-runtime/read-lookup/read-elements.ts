import { agreesWithRecordedRecord, candidateFingerprint, type TargetCandidatePool } from "../../identity";
import type { LookupRoot } from "../../selector";
import type { DomElementContext } from "../../types";
import { inRecordedLandmark } from "./in-recorded-landmark";
import { MAX_TEXT_SCAN } from "./scan-tag-matches";

/** Candidates a read's own pool may add to the family's: the scorer's budget, as `identity/candidates.ts` sets it. */
const MAX_READ_CANDIDATES = 60;

/**
 * The family's candidates, and the recorded tag's elements in the recorded
 * record and landmark that the family enumeration does not offer (`./index.ts`).
 *
 * A read's target is often no control -- a paragraph, a cell, a span -- and
 * `collectTargetCandidates` enumerates controls, so a read whose selector
 * drifted had no Level 2 at all. The elements are gated before they are scored
 * so the budget is spent on the place the recording named, and an enumeration
 * a cap cut short says so, as the family's does.
 */
export function withReadElements(family: TargetCandidatePool, target: { tagName?: string | undefined; context?: DomElementContext | undefined }, roots: readonly LookupRoot[]): TargetCandidatePool {
  if (!target.tagName) return family;
  const known = new Set(family.candidates.map((candidate) => candidate.element));
  const candidates = [...family.candidates];
  let examined = 0;
  let truncated = family.truncated;
  scan: for (const root of roots) {
    for (const element of root.querySelectorAll(target.tagName)) {
      if (known.has(element)) continue;
      if (examined >= MAX_TEXT_SCAN || candidates.length - family.candidates.length >= MAX_READ_CANDIDATES) {
        truncated = true;
        break scan;
      }
      examined += 1;
      if (!agreesWithRecordedRecord(target.context?.record, element) || !inRecordedLandmark(target.context, element)) continue;
      candidates.push({ element, fingerprint: candidateFingerprint(element, candidates.length) });
    }
  }
  return { candidates, examined: family.examined + examined, truncated };
}
