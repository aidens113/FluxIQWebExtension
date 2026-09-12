// Which of the candidates on the page is the control that was recorded.
//
// `candidates.ts` builds the pool; this module decides. The deciding is not
// done here: it is delegated to Core's element matcher
// (`fluxiq/automation-studio/fingerprinting`), which owns the signal weights,
// the per-signal comparisons and the confidence formula. A second scorer
// downstream would drift from Core's within a release and give two different
// answers to the same question, so this module contributes exactly three things
// Core cannot know about a browser: which recorded signals are worth comparing,
// how good is good enough, and how much better than the runner-up counts as an
// answer rather than a tie.
//
// **Which signals.** Only the ones a live candidate can also produce. A
// recorded descriptor carries an xpath, an attribute map and viewport bounds;
// `candidateFingerprint` produces none of the first two, and the bounds it
// produces are this instant's while the recorded ones are the capture's. Handing
// Core a signal no candidate can answer costs every candidate the same penalty,
// which moves every score down without telling the resolver anything -- and it
// drags the whole pool under the floor, turning a clear winner into a refusal.
//
// **The floor and the margin.** Core reports `normalizedScore` in [-1, 1]: the
// share of the compared weight that agreed, minus the share that disagreed. The
// floor is the point below which a candidate is not the recorded control but
// merely the least-wrong thing on the page, and the margin is what separates an
// answer from a tie. Both are measured against the identity-drift and
// ambiguous-targets fixtures rather than guessed. The margin's numbers are in
// reports/w3-matcher-packaging.md; the floor's are in
// reports/v-matcher-calibration.md, which supersedes them -- the original floor
// was calibrated against scores that Level 1 resolves before this module runs.
//
// Nothing here invents a confidence. What the resolver reports is Core's own
// `confidence` for the candidate it chose, so a Flow deciding whether to trust a
// resolution is reading the same number Core would have produced had it scored
// the candidates itself.

import {
  createAutomationStudioElementMatcher,
  type ElementFingerprint,
  type ElementFingerprintScore
} from "fluxiq/automation-studio/fingerprinting";
import type { TargetCandidate } from "./candidates";

/** A candidate and what Core made of it. */
export type ScoredCandidate = {
  element: Element;
  score: ElementFingerprintScore;
};

/**
 * What scoring concluded.
 *
 * `ambiguous` and `unmatched` both carry the ranking, so a failure can name the
 * candidates it weighed and the scores it gave them. The difference is what the
 * Flow should do: `ambiguous` means the page offers several plausible controls
 * and the Flow must say which it meant; `unmatched` means nothing on the page
 * resembles the recorded control closely enough to act on.
 */
export type CandidateSelection =
  | { outcome: "resolved"; chosen: ScoredCandidate; runnerUp: ScoredCandidate | undefined; ranked: ScoredCandidate[] }
  | { outcome: "ambiguous"; ranked: ScoredCandidate[] }
  | { outcome: "unmatched"; ranked: ScoredCandidate[] };

/**
 * The identity signals a recorded target arrives with. A superset of what is
 * scored: `implicitRole` is here because a page that writes no ARIA still has a
 * role, and `attributes` because a test id sometimes only reaches the page
 * inside it.
 */
export type RecordedIdentity = {
  visibleText?: string | undefined;
  accessibleName?: string | undefined;
  label?: string | undefined;
  id?: string | undefined;
  testId?: string | undefined;
  tagName?: string | undefined;
  role?: string | undefined;
  implicitRole?: string | undefined;
  selector?: string | undefined;
  classNames?: string[] | undefined;
  attributes?: Record<string, string> | undefined;
};

/**
 * The share of the compared weight that must agree before a candidate is an
 * answer.
 *
 * **This value was unreachable until Core recalibrated one constant, and it is
 * correct as it stands now.** `reports/v-matcher-calibration.md` measured why
 * it was unreachable: scoring runs only when every Level 1 strategy has missed,
 * which means the recorded id and test id are both gone -- and Core charged a
 * *missing* stable identifier -0.55 x 26 and -0.55 x 28, about -0.209 of the
 * scale, before a single word was compared. Of all 9,720 candidate profiles
 * that can reach Level 2 against this fixture's recorded descriptor, none
 * reached 0.35 and the highest was 0.233.
 *
 * **Lowering the floor was measured and rejected.** A floor of 0 admits the
 * drift case wanted (0.218 as it then scored) but also admits a single
 * unopposed "Save changes and exit" at 0.088 -- a different action, whose label
 * merely contains the recorded one, on a page where it is the only candidate
 * left and the margin below therefore cannot protect anything. 0.130 apart; any
 * floor between them is fitted to a hair.
 *
 * **What Core changed instead** (`reports/v-core-scoring.md`): a stable
 * identifier the candidate **does not carry** is now charged -0.1, while one
 * that **contradicts** the recording stays at -0.8. The drift case's
 * identifiers are absent and the near-miss's are contradicted, so the two
 * separate by 0.301 -- 0.389 against 0.088 -- with this floor sitting inside
 * that gap. The floor needs no movement; moving it would undo the separation.
 *
 * Not to be confused with `veto.ts`'s `TARGET_VETO_FLOOR`, which is 0. This one
 * answers a selection question -- is this good enough to choose from several?
 * -- and the veto answers a rejection question about a candidate Level 1 has
 * already chosen. Setting the veto here would refuse `selector-only` at 0.149
 * and `text-only`, which Level 1 resolves correctly.
 */
export const TARGET_SCORE_FLOOR = 0.35;

/**
 * How far ahead of the runner-up the winner has to be. Two controls that differ
 * only by a test id the recording captured score 1.0 and 0.38 on
 * ambiguous-targets, so a fifth of the scale separates a decided choice from
 * the identical twins the same fixture also offers, which score equally and
 * stay a tie.
 */
export const TARGET_SCORE_MARGIN = 0.2;

const matcher = createAutomationStudioElementMatcher();

/**
 * Ranks the pool against the recorded control and says whether one of them is
 * the answer.
 *
 * The ranking is Core's, in Core's order. The floor and the margin are applied
 * after it, so a refusal still knows exactly what it refused and how close the
 * call was.
 */
export function scoreTargetCandidates(target: RecordedIdentity, candidates: TargetCandidate[]): CandidateSelection {
  if (!candidates.length) return { outcome: "unmatched", ranked: [] };
  const elements = new Map(candidates.map((candidate) => [candidate.fingerprint, candidate.element]));
  const fingerprint = comparableFingerprint(target);
  if (!hasIdentitySignal(fingerprint)) return { outcome: "unmatched", ranked: [] };
  const ranked = matcher
    // Core drops anything below zero by default. The full ranking is kept so a
    // refusal can report what it weighed; the floor below is what decides.
    .scoreCandidates(fingerprint, candidates.map((candidate) => candidate.fingerprint), { minimumNormalizedScore: -1 })
    .flatMap((score) => {
      const element = elements.get(score.candidate);
      return element ? [{ element, score }] : [];
    });

  const chosen = ranked[0];
  if (!chosen || chosen.score.normalizedScore < TARGET_SCORE_FLOOR) return { outcome: "unmatched", ranked };
  const runnerUp = ranked[1];
  if (runnerUp && chosen.score.normalizedScore - runnerUp.score.normalizedScore < TARGET_SCORE_MARGIN) {
    return { outcome: "ambiguous", ranked };
  }
  return { outcome: "resolved", chosen, runnerUp, ranked };
}

/**
 * What Core makes of one candidate, with no floor and no margin applied.
 *
 * The plural function above answers a selection question and so applies both;
 * `veto.ts` asks a rejection question about a candidate Level 1 has already
 * chosen, where there is nothing to select between and the floor is the wrong
 * number. `undefined` means the recorded control offers nothing that could tell
 * it apart from its neighbours, which is the same guard the plural function
 * applies before ranking.
 */
export function scoreTargetCandidate(target: RecordedIdentity, candidate: TargetCandidate): ElementFingerprintScore | undefined {
  const fingerprint = comparableFingerprint(target);
  if (!hasIdentitySignal(fingerprint)) return undefined;
  return matcher.scoreCandidate(fingerprint, candidate.fingerprint);
}

/**
 * The recorded signals worth handing Core: the ones `candidateFingerprint`
 * also produces, so a comparison can come out either way.
 *
 * `role` takes the implied role when the markup declares none, matching how a
 * candidate reports its own -- otherwise a page that writes no ARIA compares an
 * empty recorded role against a live implied one and Core sees a signal that is
 * always missing on one side. A test id is read from the descriptor's own field
 * or from the attribute the recording carried it in, because the two paths
 * disagree about which one is filled.
 */
function comparableFingerprint(target: RecordedIdentity): ElementFingerprint {
  const testId = target.testId ?? target.attributes?.["data-testid"];
  const role = target.role?.trim() || target.implicitRole?.trim();
  return {
    ...(target.visibleText ? { visibleText: target.visibleText } : {}),
    ...(target.accessibleName ? { accessibleName: target.accessibleName } : {}),
    ...(target.label ? { label: target.label } : {}),
    ...(target.id ? { id: target.id } : {}),
    ...(testId ? { testId } : {}),
    ...(target.tagName ? { tagName: target.tagName.toLowerCase() } : {}),
    ...(role ? { role } : {}),
    ...(target.selector ? { selector: target.selector } : {}),
    ...(target.classNames?.length ? { classNames: target.classNames } : {})
  };
}

/** The signals that say *which* control this is, as opposed to what kind of control it is. */
const IDENTITY_SIGNALS = ["visibleText", "accessibleName", "label", "id", "testId", "selector", "classNames"] as const;

/**
 * Whether the recorded control offers anything that could tell it apart from
 * its neighbours.
 *
 * A tag and a role are the family, not the member: every candidate in the pool
 * was chosen for sharing them, so scoring by them alone ranks the whole page
 * equal-first. That is a ranking with no information in it, and it must not
 * become a choice or a tie -- a target described only by its family was never
 * found, which is what the resolver already reports.
 */
function hasIdentitySignal(fingerprint: ElementFingerprint): boolean {
  return IDENTITY_SIGNALS.some((signal) => {
    const value = fingerprint[signal];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  });
}
