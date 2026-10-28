// A press that changed nothing is given the press's own retry before it is
// reported as having had no effect (t511).
//
// **The user's rule (2026-10-07):** every node retries automatically, waiting
// for the target first; one too-early attempt must never fail a step. A press
// that landed and changed nothing has not failed in Core's terms, so Core's
// retries (`../retries/`) never see it. This is its retry: the page is looked
// at again for a bounded window, since a page may answer a press a moment
// after the first look; then, where the press may be made again, it is made
// once more and waited on the same way; and only a press that still changed
// nothing is reported as no effect (`./no-effect.ts`). Some pages take the
// first press after a change only as a wake-up and act on the second.
//
// Whether the press may be made twice at all is the caller's decision
// (`pressAgain` absent where it may not), and such a press is then reported
// after the wait alone. A press whose call declared a lasting consequence
// (`lasting`), or one on a control whose own state a press flips, is never made
// again here (`./repeat-press.ts`, t778): the page this domain reads may not
// draw an act it committed until it loads again, so the wait's looks are the
// read, and the press is said to be uncertain (`./uncertain.ts`) -- never "no
// effect", and never pressed blindly a second time. Until t778 a lasting press
// was made again when its control was still there and enabled (t513), and an
// Unsave was pressed twice, saving the job again.

import type { WebLlmSnapshotBinding } from "../../sanitize";
import type { WebRunnableNode } from "../catalog";
import { webPressNoEffect } from "./no-effect";
import { webPressedControlWords } from "./press-words";
import { webPressMayRepeat } from "./repeat-press";
import { webPressUncertain } from "./uncertain";

/** How long a press's effect is waited for, after each press, past the first look, and how often the page is looked at meanwhile. */
const EFFECT_WAIT = { windowMs: 1_500, stepMs: 250 };

/** What the caller supplies: a look at the page, the press made once more (absent where it may not be), and its clock. */
export type WebPressSettleSteps = {
  look: () => Promise<WebLlmSnapshotBinding | undefined>;
  /** Makes the press again; `true` when it ran. Absent where the press may not be made twice. */
  pressAgain: (() => Promise<boolean>) | undefined;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  /** True where the press's call declared a lasting consequence: it is never made again here (`./repeat-press.ts`). */
  lasting?: boolean;
};

/**
 * The page the press finally left; how many times it was pressed; and, of the
 * three sentences, at most one: `noEffect` where nothing changed even so,
 * `pressedAgain` where only the second press changed the page, or `uncertain`
 * where the press may not be made again here and the page drew nothing of it.
 */
export type WebPressSettled = { after: WebLlmSnapshotBinding | undefined; presses: number; noEffect?: string; pressedAgain?: string; uncertain?: string };

/** Waits on a press that changed nothing, presses it once more where it may, and says what came of it. */
export async function webPressSettled(
  node: WebRunnableNode,
  before: WebLlmSnapshotBinding | undefined,
  after: WebLlmSnapshotBinding | undefined,
  handle: string | undefined,
  steps: WebPressSettleSteps
): Promise<WebPressSettled> {
  const unchanged = (page: WebLlmSnapshotBinding | undefined) => webPressNoEffect(node, before, page, handle) !== undefined;
  if (!unchanged(after)) return { after, presses: 1 };
  let page = await waitForEffect(after, unchanged, steps);
  if (!unchanged(page)) return { after: page, presses: 1 };
  // Read through the wait and still drawn the same: a lasting press or a flipped state is not pressed blindly again.
  if (!webPressMayRepeat(page, handle, steps.lasting === true)) return { after: page, presses: 1, uncertain: webPressUncertain(before, handle) };
  const again = steps.pressAgain;
  const pressedAgain = again !== undefined && await again();
  if (pressedAgain) {
    page = await steps.look();
    if (unchanged(page)) page = await waitForEffect(page, unchanged, steps);
  }
  const presses = pressedAgain ? 2 : 1;
  if (!unchanged(page)) return { after: page, presses, pressedAgain: `Pressed again: the first press of ${webPressedControlWords(before, handle)} changed nothing, so it was pressed once more; what is said here is what that second press did.` };
  return { after: page, presses, noEffect: webPressNoEffect(node, before, page, handle, presses)! };
}

/** Looks again until the page changed or the window ran out; a look that could not be read ends the wait, since the page went somewhere. */
async function waitForEffect(
  page: WebLlmSnapshotBinding | undefined,
  unchanged: (page: WebLlmSnapshotBinding | undefined) => boolean,
  steps: WebPressSettleSteps
): Promise<WebLlmSnapshotBinding | undefined> {
  const startedAt = steps.now();
  let current = page;
  while (unchanged(current) && steps.now() - startedAt < EFFECT_WAIT.windowMs) {
    await steps.sleep(EFFECT_WAIT.stepMs);
    current = await steps.look();
  }
  return current;
}
