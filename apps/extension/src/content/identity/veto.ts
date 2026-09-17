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
// **Two rules refuse, and they answer different halves of one question.** The
// threshold asks whether the page contradicts the recording; the corroboration
// rule asks whether it confirms it at all. A candidate can fail the second
// while passing the first, because Core charges a signal the candidate is
// *missing* less than one that *contradicts* -- so a control wearing the
// recorded class set and nothing else drifts up towards zero instead of down
// away from it. reports/L-veto-recordings.md has the enumeration.
//
// ## Rule 1: the score, and why the threshold is not the Level 2 floor
//
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
//
// ## Rule 2: corroboration, and the recordings rule 1 cannot protect
//
// Rule 1 alone was proved over the wrong axis. `reports/v-level1-veto.md`
// enumerated every candidate a weak query can land on -- 1,488 class-reachable,
// 240 text-reachable -- and found none whose label contradicts the recording
// reaching 0. That enumeration held the *recording* fixed at a descriptor
// carrying an id **and** a test id, and those two signals supply most of the
// negative weight. Varying the recording instead, over the same candidate
// space: the veto's separation holds for **3 of 16** recording classes, all
// three of which carry a stable identifier *and* both text signals. Every other
// class has impostors above the line, the worst at **+0.563**. The ordinary
// case is the plain one: a control with no id and no test id, recorded with its
// text and its name, is landed on by a nameless icon button wearing the
// recorded class set at **+0.010** -- acted on.
//
// The reason is arithmetic, not a mistake in the threshold. `normalizedScore`
// divides by the weight of the signals the *recording* carried, so a thin
// recording both loses the negative weight of its identifiers and shrinks the
// denominator. A candidate that answers nothing still collects role, tag, class
// and visibility, and those add up.
//
// So a second rule, in the terms the first one is already stated in: **a weak
// Level 1 match must be corroborated by something the recording named.** If the
// recording asked a distinguishing question -- its visible text, its accessible
// name, its label, its id, its test id -- at least one of those must be
// answered by the candidate **exactly**, by the predicate `corroboration.ts`
// shares with Level 2. A candidate that answers none of them is wearing the
// recorded class set and nothing else, and the strategy that chose it is
// agreeing with itself.
//
// **The first version of that rule was free, and too weak.** It took any of
// Core's positive rungs, and over the enumeration it refused 240 impostor
// profiles and not one whose label agrees or partly agrees. But that
// enumeration counted a partial agreement as legitimate by definition, and the
// production wrong action is a partial agreement: a Level 1 match on "Save
// changes and exit", recorded as "Save changes", scored 0.633 and was clicked
// (`reports/i-resolver-safety.md`, R3). Requiring an exact agreement refuses it;
// what else that refuses is measured in reports/g-resolver-corroboration.md.
//
// **The alternative was measured and rejected.** Refusing a class-set or
// bare-text match outright whenever the recording carries no stable identifier
// costs 306 legitimate resolutions across the four identifier-less recording
// classes -- 115 whose label agrees exactly -- to stop 84 impostors, and 16 of
// those impostors come back through Level 2 anyway. That is a common failure
// traded for a rare wrong click, which is the wrong direction.
//
// ## What the veto still cannot do
//
// **A recording that names nothing is not protected and cannot be.** With no
// text, no accessible name and no identifier, the recording asked no
// distinguishing question, so there is nothing for a candidate to answer and
// both rules decline: the class set is all there is, and refusing on it would
// only be the strategy disagreeing with itself. Measured, an impostor reaches
// **+0.563** there, and Level 2 would resolve it too. It is one of the 16
// recording classes and it is named in D14 rather than closed.
//
// **An impostor that carries the recorded label exactly passes**, and so does
// one carrying a recorded identifier. Inherent: the veto asks whether the label
// corroborates, and it does. Nothing in a fingerprint can distinguish two
// controls a page has made identical.
//
// ## Rule 0: the record, which is what that last paragraph cost
//
// A page that repeats a template makes its controls identical *by design*. The
// member directory renders 240 rows, each with one action button carrying the
// design system's constant `aria-label="Row actions"` and a generated class
// shared by all of them. A recording of one of those buttons can only be
// addressed positionally, and replaying it against a page the recorded member
// had left resolved the button of *another member*: the two rules above then
// agreed on every signal, exactly, and the Flow promoted the wrong person and
// reported success (`reports/w2-wrong-row-acted-on.md`).
//
// So a third rule runs before the other two, and it is not a score. The
// recording carries which **record** -- which row, list item or card -- the
// control sat in (`record.ts`), and a candidate in another one is refused
// whatever it weighs. It fails closed: a candidate in no record at all, when
// the recording named one, disagrees. Nothing in a fingerprint can separate two
// identical controls; what is *around* them can, and this is the only rule here
// that reads it.
//
// ## What the veto reports back, and why an accept now reports it too
//
// The veto scores every Level 1 match. Until 2026-09-12 it returned that number
// only when it refused, so `resolve-target.ts` could put a measurement on a
// *failed* resolution and had nothing to put on a successful one -- the half of
// D1 that fell out of a signature rather than out of a decision. The verdict
// below carries the measurement on both paths. It is the same score, computed
// at the same point on the same critical path; only its lifetime changed.
//
// **The accepted path returns numbers and nothing else.** A successful action
// result is not redacted, so the measurement is two numbers and the sentence
// naming what was refused is built only on the refusal path, where
// `reportable-text.ts` bounds it.
//
// **No strategy is exempt, and that is a measured decision rather than a
// concession.** The obvious exemption is an id or test id match. The
// differentiation is already inside the score: Core weighs an agreeing id at 26
// and an agreeing class name at 5, so an id match is nowhere near the line, and
// it satisfies rule 2 outright. An exemption would save nothing that needs
// saving, and would let through the profiles where an identifier survives on a
// control the page has relabelled.

import { candidateFingerprint, candidateLabel, type TargetCandidate } from "./candidates";
import { corroboratesExactly } from "./corroboration";
import { agreesWithRecordedRecord } from "./record";
import { scoreTargetCandidate, type RecordedIdentity } from "./score";

/**
 * The score at or above which an exact match may be acted on. Below it, Core
 * weighed more contradiction than agreement and the match is refused.
 */
export const TARGET_VETO_FLOOR = 0;

/** Which of the three rules refused a match. */
export type TargetVetoReason =
  /** Rule 1: Core weighed more contradiction than agreement. */
  | "contradicted"
  /** Rule 2: nothing the recording named agreed exactly, whatever the score was. */
  | "uncorroborated"
  /** Rule 0: the right kind of control, in the wrong record. */
  | "other-record";

/**
 * What Core made of a match: the number rule 1 reads, and Core's own confidence
 * in it.
 *
 * Two numbers and nothing else, deliberately. This is the only thing the veto
 * hands back on the *accepting* path, and that path ends on a successful action
 * result, which nothing redacts -- so a label, a tag or any other page-derived
 * string must not appear here. The sentence describing a refusal is a separate
 * field on a separate path, built from `reportable-text.ts`.
 */
export type TargetMeasurement = {
  /** Core's `normalizedScore`: agreeing weight minus disagreeing weight, over the weight compared. */
  score: number;
  /** Core's own confidence in that score. */
  confidence: number;
};

/**
 * What the veto made of one Level 1 match, whichever way it went.
 *
 * **The measurement survives an accept, and that is the point of the shape.**
 * The veto scores every Level 1 match on the critical path already; until
 * 2026-09-12 it returned that number only when it refused and dropped it when
 * it accepted, so an exact match reached the result with no confidence at all
 * and D1's "a measurement on every resolution" was half kept. The alternative
 * was scoring the element a second time in `resolve-target.ts`, which is real
 * cost on every action for a number already computed. Nothing here is measured
 * that was not measured before; one small object outlives the call.
 *
 * Four shapes, as a union, so a refusal a *score* produced cannot be read
 * without the number behind it:
 *
 * - **nothing weighed** -- the recording named nothing distinguishing, or Core
 *   found no comparable signal, so there was no question to ask;
 * - **weighed and acted on** -- every rule passed, and the score says how well;
 * - **weighed and refused** -- `refusedBecause` names which scoring rule fired;
 * - **refused unweighed** -- the record rule, which is the one refusal no
 *   number stands behind. It is a gate and not a measurement: the candidate is
 *   in another record, so there is nothing to weigh and nothing a higher score
 *   could have changed. Writing a number here would invent one.
 */
export type TargetVerdict =
  | { measurement?: undefined; refusedBecause?: undefined }
  | { measurement: TargetMeasurement; refusedBecause?: undefined }
  | { measurement: TargetMeasurement; refusedBecause: "contradicted" | "uncorroborated" }
  | { measurement?: undefined; refusedBecause: "other-record" };

/** The same verdict, with the sentence a failure record carries. Present only on a refusal. */
export type ExactMatchVerdict = TargetVerdict & {
  /** A bounded, redaction-safe sentence naming what was refused and what it scored. */
  summary?: string | undefined;
};

/**
 * The policy, over what Core makes of one candidate. A verdict with no
 * `refusedBecause` means act.
 *
 * Separate from `vetoExactMatch` because the decision and the sentence
 * describing it are different jobs: this one reads only the fingerprint Core
 * scores, so it is the whole of the rule with none of the DOM, and it is what
 * `tests/veto.test.ts` pins both populations against.
 */
export function vetoCandidate(target: RecordedIdentity, candidate: TargetCandidate): TargetVerdict {
  // Asked first, and asked whether or not the recording named a distinguisher.
  // A row action labelled "Row actions" on all 240 rows names one -- it is just
  // the same one every time -- so the rules below cannot separate it from its
  // neighbours and only this rule can. It costs nothing when the recording
  // named no record: the check returns before it reads the page.
  if (!agreesWithRecordedRecord(target.context?.record, candidate.element)) return { refusedBecause: "other-record" };
  if (!recordedDistinguisher(target)) return {};
  const score = scoreTargetCandidate(target, candidate);
  if (!score) return {};
  const measurement: TargetMeasurement = { score: score.normalizedScore, confidence: score.confidence };
  if (measurement.score < TARGET_VETO_FLOOR) return { measurement, refusedBecause: "contradicted" };
  return corroboratesExactly(score) ? { measurement } : { measurement, refusedBecause: "uncorroborated" };
}

/**
 * Whether the element an exact strategy resolved may be acted on, and the
 * measurement that says so -- which the caller now reports whether or not the
 * answer was yes.
 *
 * No `refusedBecause` means act: either the recording named nothing that could
 * be checked, or Core weighed the element, found it no worse than even, and
 * found at least one thing the recording named agreeing on it exactly.
 */
export function vetoExactMatch(target: RecordedIdentity, element: Element): ExactMatchVerdict {
  // The record rule is asked before the fingerprint is built, because a
  // candidate in another record is refused whatever it scores and
  // `candidateFingerprint` reads layout.
  if (!agreesWithRecordedRecord(target.context?.record, element)) return refusedRecord(element);
  // The precondition is asked here as well as inside `vetoCandidate`, and not
  // for tidiness: `candidateFingerprint` reads layout, and this runs on the
  // critical path of every action. A recording that named nothing must cost
  // nothing.
  if (!recordedDistinguisher(target)) return {};
  const verdict = vetoCandidate(target, { element, fingerprint: candidateFingerprint(element, 0) });
  if (!verdict.refusedBecause) return verdict;
  // Unreachable: the record rule ran above and passed, so `vetoCandidate`
  // cannot refuse for it. Written out rather than asserted, because the
  // alternative is a non-null assertion on the measurement below.
  if (verdict.refusedBecause === "other-record") return refusedRecord(element);
  // `candidateLabel` reads the page, so it is built on the refusal path only --
  // the accepted path returns numbers and never a string.
  const because = verdict.refusedBecause === "uncorroborated" ? " with nothing the recording named agreeing exactly" : "";
  return { ...verdict, summary: `refused ${candidateLabel(element)} scoring ${verdict.measurement.score.toFixed(2)}${because}` };
}

/**
 * The record refusal, said the way a failure record may repeat it.
 *
 * `candidateLabel` is the same bounded, redaction-safe name every other refusal
 * quotes. What the *recording* said its record was is deliberately not here: it
 * is a row's words, it did not come from this page, and a failure message is not
 * where a recorded page's contents should surface.
 */
function refusedRecord(element: Element): ExactMatchVerdict {
  return { refusedBecause: "other-record", summary: `refused ${candidateLabel(element)} in another record` };
}

/**
 * Whether the recording asked a question a candidate could answer.
 *
 * This is the precondition on both rules, and it is the same list
 * `corroboration.ts` checks: with none of these, the recording named nothing
 * distinguishing, the score would reduce to the structural signals the strategy
 * already matched on, and vetoing by it would only be the strategy disagreeing
 * with itself.
 *
 * **An identifier counts, and narrowing this list back to a label was measured
 * and rejected.** Counting one puts the veto in front of the text-less
 * recordings, which is where the `coordinates` and `visual-target` strategies
 * live, and the worry was that a fresh point beside a stale identifier-only
 * descriptor would be refused. Enumerated over the point strategies, narrowing
 * would act on 120 more profiles and **not one of them carries any signal the
 * recording named** -- because a point strategy runs only after the recorded
 * selector missed, and `selectorFor` derives that selector from the strongest
 * identifier, so for a single-identifier recording the one thing that could
 * corroborate is the one thing that had to be gone. The fresh point has no
 * producer either: `coordinates` is a declared parameter of no web action, and
 * a `visual-target` is derived from the recorded element itself, so its point
 * is exactly as stale as the descriptor beside it. What this costs is named
 * rather than hidden -- 29 of 587 descriptors across the fixture corpus carry
 * an identifier and no text, name or label, and a replay of one whose
 * identifier has changed now fails instead of clicking whatever holds the
 * recorded position. reports/p-veto-coords.md has both enumerations.
 */
function recordedDistinguisher(target: RecordedIdentity): boolean {
  return Boolean(
    target.visibleText?.trim() || target.accessibleName?.trim() || target.label?.trim() ||
    target.id?.trim() || target.testId?.trim() || target.attributes?.["data-testid"]?.trim()
  );
}
