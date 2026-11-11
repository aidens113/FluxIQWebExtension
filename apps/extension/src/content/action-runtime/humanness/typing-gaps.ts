// The gaps between a person's keystrokes: skewed around a mean that grows with
// the level, with an occasional longer hesitation.
//
// One gap before each character after the first, so the same characters, the
// same events in the same order, and the same final value as typing without
// gaps (`../keyboard/type-text.ts`). The gaps are a plan: the caller fits them
// within the command's own time (`fit-within-command.ts`) by scaling them,
// so a long text is typed faster rather than the command running out.

import type { CommandHumanness } from "./command-humanness";
import { skewedDelayMs } from "./skewed-delay";

/** The mean gap at full humanness: about five keystrokes a second. */
const KEY_GAP_MEAN_MS_AT_FULL = 160;

/** The log-normal spread of a gap. */
const KEY_GAP_SPREAD = 0.45;

/** How often a gap is a hesitation. */
const HESITATION_CHANCE = 0.05;

/** A hesitation adds between two and six mean gaps. */
const HESITATION_LEAST_GAPS = 2;
const HESITATION_EXTRA_GAPS = 4;

/** The planned gap before each character of `text` after its first, in milliseconds. */
export function typingGaps(text: string, human: CommandHumanness): number[] {
  const characters = [...text].length;
  const mean = KEY_GAP_MEAN_MS_AT_FULL * human.share;
  const gaps: number[] = [];
  for (let index = 1; index < characters; index += 1) {
    const gap = skewedDelayMs(human.random, mean, KEY_GAP_SPREAD);
    const hesitation = human.random() < HESITATION_CHANCE ? mean * (HESITATION_LEAST_GAPS + HESITATION_EXTRA_GAPS * human.random()) : 0;
    gaps.push(gap + hesitation);
  }
  return gaps;
}
