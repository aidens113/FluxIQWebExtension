// Whether the control a press named was chosen before the press and after it,
// read from the view's line facts on both sides by the handle the press named
// (t174-w82, t174-w103). Two readers share it: the sentence the press's result
// says first (`./choice.ts`) and the statement the draft pairs presses by
// (`./toggle.ts`), so the two can never disagree about one press.
//
// "Chosen" is what the view prints for it (`../../page-view/element/state-tokens.ts`):
// `marked` (drawn apart from its siblings), `selected` (`aria-selected`) and
// `checked`. Only a node that changes the page in place is read, on one
// location both sides, with the handle's line on both.

import type { WebLlmSnapshotBinding } from "../../sanitize";
import { webLlmLineFacts, type WebLlmLineFact } from "../../page-view";
import type { WebRunnableNode } from "../catalog";
import { webMovesThePage } from "../start-location";

const CHOSEN: readonly string[] = ["marked", "selected", "checked"];

/** The pressed control's line before and after, and whether it was chosen on each side. */
export type WebPressChosenState = { was: WebLlmLineFact; now: WebLlmLineFact; chosenBefore: boolean; chosenAfter: boolean };

/**
 * The pressed control's chosen state on both sides, or `undefined`: a node that
 * does not change the page in place, a page missing on either side or
 * elsewhere, or a handle on neither side.
 */
export function webPressChosenState(
  node: WebRunnableNode,
  before: WebLlmSnapshotBinding | undefined,
  after: WebLlmSnapshotBinding | undefined,
  handle: string | undefined
): WebPressChosenState | undefined {
  if (node.effect !== "mutate" || webMovesThePage(node) || handle === undefined) return undefined;
  if (before === undefined || after === undefined || before.evidence.location !== after.evidence.location) return undefined;
  const was = lineOf(before, handle);
  const now = lineOf(after, handle);
  if (was === undefined || now === undefined) return undefined;
  return { was, now, chosenBefore: chosen(was), chosenAfter: chosen(now) };
}

function lineOf(page: WebLlmSnapshotBinding, handle: string): WebLlmLineFact | undefined {
  return webLlmLineFacts(page.evidence).find((line) => line.handle === handle);
}

function chosen(line: WebLlmLineFact): boolean {
  return line.tokens.some((token) => CHOSEN.includes(token));
}
