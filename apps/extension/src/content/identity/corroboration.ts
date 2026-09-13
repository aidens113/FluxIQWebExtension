// The question both acting paths ask of a scored match before it is acted on:
// did anything that says *which* control this is agree with the recording
// exactly?
//
// Two paths act on Core's score. `score.ts` resolves the candidate Level 2 ranks
// first once it clears the floor and the margin, and `veto.ts` lets a Level 1
// match through when the page does not contradict it and something the
// recording named agrees. Until 2026-09-13 both accepted a *partial* agreement,
// and a partial agreement is what a different action looks like.
//
// **The evidence** (`reports/i-resolver-safety.md` "(a)"). Core's text comparison
// gives one 0.82 rung to "the candidate says less" and "the candidate says
// more", so a shortened "Save" and a different action, "Save changes and exit",
// score identically against a recorded "Save changes": 0.640 and 0.640 on a
// recording with no identifiers, 0.359 and 0.359 on an authored one. No floor,
// margin or veto threshold separates identical numbers, and the wrong action
// was clicked and reported as a success through Level 2 (0.633) and through the
// Level 1 veto alike.
//
// **The rule.** At least one distinguishing signal the recording carried agrees
// at Core's exact rung: the visible text, the accessible name or the label at a
// similarity of 0.92 or more, or the id or the test id equal. Structural
// signals -- role, tag, selector, class names, visibility -- never count: they
// say what kind of control a candidate is, and a weak query or a crowded family
// already agrees on them.
//
// **Not a second scorer.** Nothing here compares a string. It reads the
// contributions Core returned: which signal each scored, and the similarity Core
// charged it, which is the contribution's `score` over its `weight`
// (`element-fingerprint.ts`, `contribute`). Core names the same 0.92 rung "text
// matched exactly", and an identifier contributes positively only when it is
// equal. Were Core to publish the similarity on the contribution, this would
// read it there; the rung would not move.
//
// **What it costs, named.** The recorded control shortened to "Save", with no
// aria-label and no surviving identifier, scores exactly what the wrong action
// scores, so it is refused too; so is any drift that kept only an overlapping
// label, and any recording that named no distinguishing signal at all. That is
// the trade: a replay that stops and says the target is gone, instead of one
// that clicks a different action and says it succeeded. The measured cost is in
// reports/g-resolver-corroboration.md.

import type { ElementFingerprintScore } from "fluxiq/automation-studio/fingerprinting";

/** Core's exact rung: `compareTextSignal` calls a similarity at or above this "text matched exactly". */
const EXACT_SIMILARITY = 0.92;

/**
 * The signals that say *which* control a candidate is. `score.ts` ranks by more
 * than these, and `veto.ts` asks whether the recording carried any of them; this
 * list is what may corroborate.
 */
const DISTINGUISHING_SIGNALS: readonly string[] = ["visibleText", "accessibleName", "label", "id", "testId"];

/**
 * Whether at least one distinguishing signal the recording carried agreed with
 * the candidate exactly, by Core's own measure.
 *
 * Core contributes a signal only when the recording carried it, so "the
 * recording carried" needs no second look at the recording: a recording that
 * named none of these signals cannot be corroborated.
 */
export function corroboratesExactly(score: ElementFingerprintScore): boolean {
  return score.positiveContributions.some((contribution) =>
    DISTINGUISHING_SIGNALS.includes(contribution.signalPath) &&
    contribution.weight > 0 &&
    contribution.score / contribution.weight >= EXACT_SIMILARITY
  );
}
