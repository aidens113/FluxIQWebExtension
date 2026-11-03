// Which DOM candidate is the control that was recorded. The web domain owns
// the calibrated signal weights and comparisons; Core only aggregates those
// measurements into the shared score/confidence contract. This module filters
// stale identifiers and signals candidates cannot emit, applies the calibrated
// floor and winner margin, and requires corroborating identity.
//
// Drawing evidence is adapted into the matcher's attributes slot only when the
// drawing agrees. Read-word evidence breaks exact ties without letting old text
// choose a different element. The selection retains dropped-token diagnostics.
// Existing calibration reports remain reports/w3-matcher-packaging.md and
// reports/v-matcher-calibration.md; moving ownership changes no web score.

import { createWebElementMatcher, type WebElementFingerprint as ElementFingerprint, type WebElementFingerprintScore as ElementFingerprintScore } from "@fluxiq-web-extension/domain/client";
import { isVolatileIdentifier, quotedAnchors, selectorQuotesVolatileIdentifier } from "../selector";
import type { TargetCandidate } from "./candidates";
import { corroboratesExactly } from "./corroboration";
import { DRAWING_ATTRIBUTE } from "./drawing-attribute";
import { pageTokens, type PageTokens } from "./page-tokens";
import { recordedPlaceRefusal, type RecordedPlace } from "./place";
import { readWordsOf } from "./read-words";

/** A candidate and what the domain matcher measured. */
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
 * resembles the recorded control closely enough to act on, or that the best of
 * it agrees exactly with nothing that says which control it is.
 */
export type CandidateSelection = (
  | { outcome: "resolved"; chosen: ScoredCandidate; runnerUp: ScoredCandidate | undefined; ranked: ScoredCandidate[] }
  | { outcome: "ambiguous"; ranked: ScoredCandidate[] }
  | { outcome: "unmatched"; ranked: ScoredCandidate[] }
) & {
  /** The recorded identifiers left out of the comparison, when any were. */
  dropped?: readonly DroppedToken[] | undefined;
};

/**
 * A recorded identifier that was not handed to Core, and why: `absent`, no
 * element on the page carries it; `generated`, its shape says a rendering drew
 * it and no candidate still carries it. `token` is the id, or for a selector the
 * identifier it quoted that is gone -- or, when its shape was the reason, the
 * selector itself.
 */
export type DroppedToken = { signal: "id" | "selector"; token: string; because: "absent" | "generated" };

/**
 * The identity signals a recorded target arrives with. A superset of what is
 * scored: `implicitRole` is here because a page that writes no ARIA still has a
 * role, and `attributes` because a test id sometimes only reaches the page
 * inside it.
 */
export type RecordedIdentity = {
  /**
   * Where the element sat: its record, dialog and landmark. None is scored -- Core's matcher has no
   * positional or structural signal, as `candidates.ts` measures -- but each is
   * a gate applied before ranking: a candidate in another row, dialog or
   * landmark is not the recorded control at any score.
   */
  context?: RecordedPlace | undefined;
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
  /** What a wordless control drew (`./drawing.ts`); compared where a candidate draws the same (header). */
  drawing?: string | undefined;
  /**
   * The step reads this element's words, so they are its value and not a veto
   * (`./read-words.ts`, t743 D2b): they break ties and never lower a candidate.
   */
  readsWords?: boolean | undefined;
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
 * separate by 0.301 -- 0.389 against 0.088 -- with this floor inside that gap.
 *
 * **That separation holds only for a near-miss whose identifiers contradict.**
 * With none of its own the same "Save changes and exit" scores 0.359: 0.030
 * under the drift case, and level with the recorded Save shortened to "Save".
 * On a recording with no identifiers it scores 0.633
 * (`reports/i-resolver-safety.md`). No floor sits between identical numbers, so
 * this one did not move; `corroboration.ts`, applied to the winner, draws the
 * separation instead.
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

/**
 * The weight a drawing is compared at: a label's (20 of Core's scale), since a
 * picture is what names a control that has no words. At the slot's default 6
 * the recorded icon beside its row's other icons led by less than the margin
 * once the selector both lack was charged; at 20 it leads by more than it.
 */
const DRAWING_WEIGHT = 20;

const matcher = createWebElementMatcher({ weights: { attributes: DRAWING_WEIGHT } });

/**
 * Ranks the pool against the recorded control and says whether one of them is
 * the answer.
 *
 * The ranking is Core's, in Core's order. The floor, the margin and the
 * corroboration rule are applied after it, so a refusal still knows exactly
 * what it refused and how close the call was.
 */
export function scoreTargetCandidates(target: RecordedIdentity, candidates: TargetCandidate[]): CandidateSelection {
  if (!candidates.length) return { outcome: "unmatched", ranked: [] };
  const read = readWordsOf(target);
  if (read) return scoreReadTarget(target, read, candidates);
  // The record gate, before the ranking rather than after it. A candidate in
  // another row is not the recorded control, so it must not be ranked, reported
  // as a near miss, or allowed to tie with one that is: on a 240-row table it
  // would otherwise fill the pool and turn "the recorded row is gone" into "239
  // candidates tied". Applied here rather than at the two call sites so a third
  // one cannot forget it. When the recording named no record this returns every
  // candidate without reading the page.
  //
  // The dialog gate beside it, for the same reason (t469): with the chat panel
  // gone, the notifications prompt's close button won the ranking by 0.6 as
  // the chat's "Close chat", and was pressed.
  const eligible = candidates.filter((candidate) => recordedPlaceRefusal(target.context, candidate.element) === undefined);
  if (!eligible.length) return { outcome: "unmatched", ranked: [] };
  const { fingerprint, dropped } = comparableFingerprint(target, eligible);
  const measured = dropped.length ? { dropped } : {};
  if (!hasIdentitySignal(fingerprint, target.drawing)) return { outcome: "unmatched", ranked: [], ...measured };
  // Each candidate against its own comparison, which differs from the shared one
  // only by a drawing it agrees with (header). Core's `scoreCandidates` would
  // drop anything below zero; every candidate is kept here so a refusal can
  // report what it weighed, and the floor below is what decides.
  const ranked = eligible
    .map((candidate): ScoredCandidate => ({ element: candidate.element, score: matcher.scoreCandidate(withAgreeingDrawing(fingerprint, target.drawing, candidate), candidate.fingerprint) }))
    .sort(coreOrder);

  const chosen = ranked[0];
  if (!chosen || chosen.score.normalizedScore < TARGET_SCORE_FLOOR) return { outcome: "unmatched", ranked, ...measured };
  const runnerUp = ranked[1];
  if (runnerUp && chosen.score.normalizedScore - runnerUp.score.normalizedScore < TARGET_SCORE_MARGIN) {
    return { outcome: "ambiguous", ranked, ...measured };
  }
  // A winner nothing distinguishing agrees with exactly is not an answer, however
  // far it leads. Checked last, so a tie is still reported as the tie it is.
  if (!corroboratesExactly(chosen.score)) return { outcome: "unmatched", ranked, ...measured };
  return { outcome: "resolved", chosen, runnerUp, ranked, ...measured };
}

/**
 * A read target's selection (header): ranked without its words, then a tie --
 * or a lead nothing else confirms -- settled by the one candidate whose words
 * agree, then the selection with its words if that resolves. Otherwise the
 * selection without the words, so a refusal reports the ranking that decided
 * it -- unless that ranked nothing, when the words were all there was.
 */
function scoreReadTarget(target: RecordedIdentity, read: NonNullable<ReturnType<typeof readWordsOf>>, candidates: TargetCandidate[]): CandidateSelection {
  const plain = scoreTargetCandidates(read.unworded, candidates);
  if (plain.outcome === "resolved") return plain;
  const settled = settledByWords(plain, read, candidates);
  if (settled) return settled;
  const worded = scoreTargetCandidates({ ...target, readsWords: undefined }, candidates);
  if (!plain.ranked.length) return worded;
  // The words may confirm the element the rest chose; they may never choose another over it (header).
  return worded.outcome === "resolved" && worded.chosen.element === plain.ranked[0]!.element ? worded : plain;
}

/** How close two scores are to count as the same score, not a lead: float noise only. */
const LEVEL_EPSILON = 1e-9;

/** The one candidate, among those level at the top of `plain`, whose words agree with the read's; or nothing (header). */
function settledByWords(plain: CandidateSelection, read: NonNullable<ReturnType<typeof readWordsOf>>, candidates: readonly TargetCandidate[]): CandidateSelection | undefined {
  const top = plain.ranked[0]?.score.normalizedScore;
  if (top === undefined || top < TARGET_SCORE_FLOOR || !read.words.length) return undefined;
  // Level means equal, not within the margin: a paragraph the selector agrees with outscores one that merely shows the old words (header).
  const level = plain.ranked.filter((scored) => top - scored.score.normalizedScore < LEVEL_EPSILON);
  const agreeing = level.filter((scored) => {
    const candidate = candidates.find((entry) => entry.element === scored.element);
    return candidate !== undefined && read.agrees(candidate.fingerprint);
  });
  const chosen = agreeing.length === 1 ? agreeing[0] : undefined;
  if (!chosen) return undefined;
  const runnerUp = plain.ranked.find((scored) => scored !== chosen);
  return { outcome: "resolved", chosen, runnerUp, ranked: plain.ranked, ...(plain.dropped ? { dropped: plain.dropped } : {}) };
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
  const { fingerprint } = comparableFingerprint(target, [candidate]);
  if (!hasIdentitySignal(fingerprint, target.drawing)) return undefined;
  return matcher.scoreCandidate(withAgreeingDrawing(fingerprint, target.drawing, candidate), candidate.fingerprint);
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
function comparableFingerprint(target: RecordedIdentity, pool: readonly TargetCandidate[]): { fingerprint: ElementFingerprint; dropped: DroppedToken[] } {
  const testId = target.testId ?? target.attributes?.["data-testid"];
  const role = target.role?.trim() || target.implicitRole?.trim();
  const page = pageTokens(pool[0]?.element);
  const dropped: DroppedToken[] = [];
  const id = comparableIdentifier(target.id, pool, page, dropped);
  const selector = comparableSelector(target.selector, pool, page, dropped);
  const fingerprint: ElementFingerprint = {
    ...(target.visibleText ? { visibleText: target.visibleText } : {}),
    ...(target.accessibleName ? { accessibleName: target.accessibleName } : {}),
    ...(target.label ? { label: target.label } : {}),
    ...(id ? { id } : {}),
    ...(testId ? { testId } : {}),
    ...(target.tagName ? { tagName: target.tagName.toLowerCase() } : {}),
    ...(role ? { role } : {}),
    ...(selector ? { selector } : {}),
    ...(target.classNames?.length ? { classNames: target.classNames } : {})
  };
  return { fingerprint, dropped };
}

/**
 * The recorded id, unless it says nothing about this page.
 *
 * Two filters, the cheap one first. The shape rule: an id a rendering
 * generated is kept only when a candidate in the pool still carries that very
 * token -- the ordinary same-build replay, where Level 1 matched by id and the
 * veto is asking whether to act on it. Then the page: an id no element on the
 * page carries is dropped whatever its shape, because the page has stopped
 * naming anything by it. An id some element still carries is kept, and Core
 * compares it as it always has -- agreement on the element that holds it,
 * contradiction on every other.
 */
function comparableIdentifier(id: string | undefined, pool: readonly TargetCandidate[], page: PageTokens, dropped: DroppedToken[]): string | undefined {
  if (!id) return undefined;
  if (isVolatileIdentifier(id) && !pool.some((candidate) => candidate.fingerprint.id === id)) {
    dropped.push({ signal: "id", token: id, because: "generated" });
    return undefined;
  }
  if (page.carries("id", id) === false) {
    dropped.push({ signal: "id", token: id, because: "absent" });
    return undefined;
  }
  return id;
}

/**
 * The recorded selector, under the same two filters: dropped where the token
 * it is addressed through was generated and has gone, or where any identifier
 * it quotes is carried by no element on the page -- a selector through a token
 * nothing holds addresses nothing.
 */
function comparableSelector(selector: string | undefined, pool: readonly TargetCandidate[], page: PageTokens, dropped: DroppedToken[]): string | undefined {
  if (!selector) return undefined;
  if (selectorQuotesVolatileIdentifier(selector) && !pool.some((candidate) => candidate.fingerprint.selector === selector)) {
    dropped.push({ signal: "selector", token: selector, because: "generated" });
    return undefined;
  }
  const absent = quotedAnchors(selector).find((anchor) => page.carries(anchor.attribute, anchor.value) === false);
  if (absent) {
    dropped.push({ signal: "selector", token: absent.written, because: "absent" });
    return undefined;
  }
  return selector;
}

/**
 * The signals that say *which* control this is, as opposed to what kind of
 * control it is.
 *
 * `veto.ts` keeps a narrower list of the same kind, and the difference is
 * deliberate: this one asks whether the recording offers anything worth scoring
 * and so counts the selector and the class names, while the veto asks what
 * *corroborates* a match a weak query already made on those two.
 */
const IDENTITY_SIGNALS = ["visibleText", "accessibleName", "label", "id", "testId", "selector", "classNames"] as const;

/**
 * Whether the recorded control offers anything that could tell it apart from
 * its neighbours.
 *
 * A tag and a role are the family, not the member: every candidate in the pool
 * was chosen for sharing them, so scoring by them alone ranks the whole page
 * equal-first. That is a ranking with no information in it, and it must not
 * become a choice or a tie -- a target described only by its family was never
 * found, which is what the resolver already reports. A drawing says which
 * control as words do, so a recording that names only its family and its
 * drawing is still worth scoring.
 */
function hasIdentitySignal(fingerprint: ElementFingerprint, drawing: string | undefined): boolean {
  if (drawing?.trim()) return true;
  return IDENTITY_SIGNALS.some((signal) => {
    const value = fingerprint[signal];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  });
}

/**
 * The comparison for one candidate: the shared one, plus the recorded drawing
 * when the candidate draws exactly that (header). Nothing is added for a
 * candidate that draws nothing or something else, so the drawing never counts
 * against one.
 */
function withAgreeingDrawing(fingerprint: ElementFingerprint, drawing: string | undefined, candidate: TargetCandidate): ElementFingerprint {
  if (!drawing?.trim() || candidate.fingerprint.attributes?.[DRAWING_ATTRIBUTE] !== drawing) return fingerprint;
  return { ...fingerprint, attributes: { [DRAWING_ATTRIBUTE]: drawing } };
}

/** the domain matcher's own ranking order (`scoreElementFingerprintCandidates`): total, then normalized score, then candidate id. */
function coreOrder(left: ScoredCandidate, right: ScoredCandidate): number {
  return right.score.totalScore - left.score.totalScore
    || right.score.normalizedScore - left.score.normalizedScore
    || left.score.candidateId.localeCompare(right.score.candidateId);
}
