// How long a person's eyes stay on the page after it scrolls: skewed around a
// mean that grows with the level. A plan, fitted within the command's own time
// by the caller (`fit-within-command.ts`).

import type { CommandHumanness } from "./command-humanness";
import { skewedDelayMs } from "./skewed-delay";

/** The mean dwell at full humanness. */
const DWELL_MEAN_MS_AT_FULL = 900;

/** The log-normal spread of a dwell. */
const DWELL_SPREAD = 0.5;

/** The planned dwell after a scroll, in milliseconds. Two draws of the command's generator. */
export function scrollDwellMs(human: CommandHumanness): number {
  return skewedDelayMs(human.random, DWELL_MEAN_MS_AT_FULL * human.share, DWELL_SPREAD);
}
