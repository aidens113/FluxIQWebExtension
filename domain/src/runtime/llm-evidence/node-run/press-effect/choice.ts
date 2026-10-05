// What a press did to the choice of the very control it pressed, in one plain
// sentence (t174-w82, cause 1 of `run-murwd8le-79e735a8`).
//
// Step 0013 of that run pressed `t941 clickable "Space Grey" marked`: the
// colour already chosen, which un-chose it. Step 0014's result said so, as
// `t941 "Space Grey" no longer marked`, the second of four change lines, and
// at 0026 the model claimed the colour was chosen; only the Add to cart the
// page then refused brought it back. Nothing refuses such a press -- a person
// may press a chosen option, and on some pages that is the step -- so the
// result says what it did, ahead of the change list, where it is read first.
//
// Whether the control was chosen on each side is read once, in
// `./chosen-state.ts`, which the draft statement's `toggle` reads too
// (`./toggle.ts`), so the sentence and the statement never disagree. The words
// are the ones the model was shown on the control's own view line.

import type { WebLlmSnapshotBinding } from "../../sanitize";
import { quotedWords } from "../../page-view";
import type { WebRunnableNode } from "../catalog";
import { webPressChosenState } from "./chosen-state";

/**
 * The sentence for a press that un-chose -- or chose -- the control it pressed,
 * or `undefined`: a node that does not change the page in place, a page missing
 * on either side or elsewhere, a handle on neither, or a choice left as it was.
 */
export function webPressChoice(
  node: WebRunnableNode,
  before: WebLlmSnapshotBinding | undefined,
  after: WebLlmSnapshotBinding | undefined,
  handle: string | undefined
): string | undefined {
  const state = webPressChosenState(node, before, after, handle);
  if (state === undefined || state.chosenBefore === state.chosenAfter) return undefined;
  const words = state.was.words ?? state.now.words;
  const named = words === undefined ? (state.was.kind ?? "the control") : quotedWords(words);
  return state.chosenBefore ? `This press un-chose ${named}: it was chosen before.` : `This press chose ${named}: it was not chosen before.`;
}
