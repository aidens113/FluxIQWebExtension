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
// A press whose call declared a lasting consequence is never made again here:
// whether it may be is the caller's decision (`pressAgain` absent), and it is
// then reported after the wait alone.

import type { WebLlmSnapshotBinding } from "../../sanitize";
import type { WebRunnableNode } from "../catalog";
import { webPressNoEffect } from "./no-effect";
import { webPressedControlWords } from "./press-words";

/** How long a press's effect is waited for, after each press, past the first look, and how often the page is looked at meanwhile. */
const EFFECT_WAIT = { windowMs: 1_500, stepMs: 250 };

/** What the caller supplies: a look at the page, the press made once more (absent where it may not be), and its clock. */
export type WebPressSettleSteps = {
  look: () => Promise<WebLlmSnapshotBinding | undefined>;
  /** Makes the press again; `true` when it ran. Absent where the press may not be made twice. */
  pressAgain: (() => Promise<boolean>) | undefined;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
};

/**
 * The page the press finally left; how many times it was pressed; and, of the
 * two sentences, at most one: `noEffect` where nothing changed even so, or
 * `pressedAgain` where only the second press changed the page.
 */
export type WebPressSettled = { after: WebLlmSnapshotBinding | undefined; presses: number; noEffect?: string; pressedAgain?: string };

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
  const pressedAgain = steps.pressAgain !== undefined && await steps.pressAgain();
  if (pressedAgain) {
    page = await steps.look();
    if (unchanged(page)) page = await waitForEffect(page, unchanged, steps);
  }
  const presses = pressedAgain ? 2 : 1;
  if (!unchanged(page)) return { after: page, presses, pressedAgain: `The first press of ${webPressedControlWords(before, handle)} changed nothing, so it was pressed once more; what is said here is what that second press did.` };
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
