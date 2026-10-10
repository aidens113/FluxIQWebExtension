// The words that say a press acts rather than closes, read over the rest of a
// control a press would reach (t401, `acting-control.ts`).

import { hasConsequentialWord } from "../consequential-word";

/**
 * Words that say a press does something rather than closing what it sits on:
 * it repeats a refused act, confirms, submits, accepts, signs up, sends, or goes
 * on to whatever the layer offered. A closed list on word boundaries, read by
 * `acting-control.ts` over the wording of the control a press would reach --
 * its own name and text and those of the button or link around it -- whenever
 * that wording is not itself an admitted way out. So a close glyph inside a
 * "Retry" button, or an "X" whose button is named "Try again", is refused
 * although the glyph alone is a dismissal (t401).
 *
 * "accepting" is not "accept": "Continue without accepting" declines, and it is
 * an admitted way out before this list is read.
 */
const ACTING_WORD = /\b(?:try again|retry|retries|resend|confirm|confirms|submit|submits|send|sends|accept|accepts|accepted|agree|agrees|yes|sign up|signup|sign in|log in|login|register|join|continue|proceed|enable|turn on|install|claim|redeem|reload|refresh)\b/iu;

/** Whether wording that is not an admitted way out says its press acts: the acting list, or the consequential one. */
export function isActingWording(text: string): boolean {
  return ACTING_WORD.test(text) || hasConsequentialWord(text);
}
