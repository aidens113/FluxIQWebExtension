// Whether an exact match is allowed to be acted on.
//
// Level 1 asks "is this exact thing still here?" and, when a query answers,
// clicks the answer. That is the right shape for speed and the wrong shape for
// safety, because the queries are not equally strong. `element-finder.ts` tries
// the recorded selector, the xpath, the id, the test id, the authored name, the
// class set, and finally the exact text -- and the last three collide
// constantly. Measured on the identity-drift fixture: a page whose Save button
// has been replaced by `<button class="btn btn-primary">Delete workspace</button>`
// is resolved by the class-set query and clicked, while Level 2 scores the same
// element -0.237 and refuses it. Every safety property the resolver has -- the
// floor, the margin, the ambiguity refusal -- guarded Level 2 only.
//
// So Level 1 still selects, and this module vetoes. The selection is unchanged
// and so is its precedence; what changes is that the answer is checked against
// the recording before it is acted on, by the same scorer Level 2 uses.
//
// **The threshold is not the Level 2 floor, and the difference is the point.**
// The floor answers a selection question -- "is this good enough to choose from
// several?" -- and sits at 0.35. This answers a rejection question: "is this so
// wrong that acting would be dangerous?". They are different questions and they
// get different numbers. A veto at the floor would refuse the drift recovery
// this resolver exists to provide: `selector-only` resolves correctly at 0.149,
// `text-only` at 0.170.
//
// **Zero is a statement, not a fit.** Core's `normalizedScore` is the share of
// the compared weight that agreed minus the share that disagreed, so a negative
// score means the page contradicts more of the recording than it confirms.
// Enumerating every candidate profile a weak query can land on against the
// fixture's recorded descriptor -- 1,488 for the class set, 240 for the exact
// text -- **not one profile whose label contradicts the recording reaches 0**
// (the highest is -0.032), and the correct drift recoveries sit at 0.149 and
// above. The separating band is (-0.032, 0.149] and zero carries a meaning
// inside it. reports/v-level1-veto.md has the full tables.
//
// **No strategy is exempt, and that is a measured decision rather than a
// concession.** The obvious exemption is an id or test id match, on the grounds
// that those are strong author-supplied identifiers. The differentiation is
// already inside the score: Core weighs an agreeing id at 26 and an agreeing
// class name at 5, so an id match is nowhere near the line to begin with -- over
// the same enumeration, **no profile carrying the recorded id or test id is ever
// vetoed while its label agrees**. An exemption would therefore save nothing
// that needs saving, and would let through the 339 enumerated profiles where an
// identifier survives on a control the page has relabelled to something else. A
// second, cruder weighting on top of Core's is not worth that.
//
// **What the veto cannot do.** It checks a match against the recorded *label*,
// so a recording that captured no text signal is not protected by it -- there is
// nothing to corroborate against, and a score built from structure alone would
// re-decide the strategy's own question. An impostor that carries the recorded
// label is not caught either. Both limits are in the report.

import { candidateFingerprint, candidateLabel } from "./candidates";
import { scoreTargetCandidate, type RecordedIdentity } from "./score";

/**
 * The score at or above which an exact match may be acted on. Below it, Core
 * weighed more contradiction than agreement and the match is refused.
 */
export const TARGET_VETO_FLOOR = 0;

/** Why an exact match was refused, in the terms a failure record can carry. */
export type TargetVeto = {
  /** Core's measurement of the refused match, which is the whole of the decision. */
  score: number;
  /** A bounded, redaction-safe sentence naming what was refused and what it scored. */
  summary: string;
};

/**
 * Whether the element an exact strategy resolved contradicts the recording
 * badly enough to refuse, and the measurement that says so.
 *
 * `undefined` means act: either the recording carries no label to check the
 * match against, or Core weighed the element and found it no worse than
 * even.
 */
export function vetoExactMatch(target: RecordedIdentity, element: Element): TargetVeto | undefined {
  if (!recordedLabel(target)) return undefined;
  const score = scoreTargetCandidate(target, { element, fingerprint: candidateFingerprint(element, 0) });
  if (!score || score.normalizedScore >= TARGET_VETO_FLOOR) return undefined;
  return {
    score: score.normalizedScore,
    summary: `refused ${candidateLabel(element)} scoring ${score.normalizedScore.toFixed(2)}`
  };
}

/**
 * The recorded text a match can be corroborated against. All three are compared
 * by Core as text, and any one of them is enough for the score to carry the
 * label's verdict; with none of them the score reduces to the structural
 * signals the strategy already matched on, and vetoing by it would only be the
 * strategy disagreeing with itself.
 */
function recordedLabel(target: RecordedIdentity): boolean {
  return Boolean(target.visibleText?.trim() || target.accessibleName?.trim() || target.label?.trim());
}
