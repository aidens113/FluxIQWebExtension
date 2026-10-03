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
// "Chosen" is what the view prints for it (`../../page-view/element/state-tokens.ts`):
// `marked` (drawn apart from its siblings), `selected` (`aria-selected`) and
// `checked`. Read from the view's line facts on both sides, by the handle the
// press named, so the words are the ones the model was shown.

import type { WebLlmSnapshotBinding } from "../../sanitize";
import { quotedWords, webLlmLineFacts, type WebLlmLineFact } from "../../page-view";
import type { WebRunnableNode } from "../catalog";
import { webMovesThePage } from "../start-location";

const CHOSEN: readonly string[] = ["marked", "selected", "checked"];

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
  if (node.effect !== "mutate" || webMovesThePage(node) || handle === undefined) return undefined;
  if (before === undefined || after === undefined || before.evidence.location !== after.evidence.location) return undefined;
  const was = lineOf(before, handle);
  const now = lineOf(after, handle);
  if (was === undefined || now === undefined) return undefined;
  const chosenBefore = chosen(was);
  if (chosenBefore === chosen(now)) return undefined;
  const words = was.words ?? now.words;
  const named = words === undefined ? (was.kind ?? "the control") : quotedWords(words);
  return chosenBefore ? `This press un-chose ${named}: it was chosen before.` : `This press chose ${named}: it was not chosen before.`;
}

function lineOf(page: WebLlmSnapshotBinding, handle: string): WebLlmLineFact | undefined {
  return webLlmLineFacts(page.evidence).find((line) => line.handle === handle);
}

function chosen(line: WebLlmLineFact): boolean {
  return line.tokens.some((token) => CHOSEN.includes(token));
}
