// What a press did to the choice of the very control it pressed, as the draft
// statement Core pairs presses by (t174-w103): the control's handle and which
// way the press flipped it.
//
// Live run `run-murwd8le-79e735a8` kept a press of Space Grey that un-chose the
// colour the page arrived with, and the press that chose it again joined the
// Flow as an opener of Add to cart; `run-musp8nz1-dbd3905a` added both presses
// itself. Whole-page digests cannot see that the two cancel -- other steps
// between them changed the page -- so the domain names the control, and Core
// takes such a pair out of the Flow (`AS/runtime/flow-draft/reversal.ts`).
//
// The key is the canonical handle the call named: a handle names one control
// on one page for the whole Flow's authoring, and it already crosses to Core
// and the model in the call's `input`, so it says nothing new.

import type { WebLlmSnapshotBinding } from "../../sanitize";
import type { WebRunnableNode } from "../catalog";
import { webPressChosenState } from "./chosen-state";

/**
 * `{key, to}` for a press that flipped whether the control it pressed is
 * chosen -- `on` when it chose it, `off` when it un-chose it -- or `undefined`
 * wherever `./choice.ts` says no sentence, and for a choice left as it was.
 */
export function webPressToggle(
  node: WebRunnableNode,
  before: WebLlmSnapshotBinding | undefined,
  after: WebLlmSnapshotBinding | undefined,
  handle: string | undefined
): { key: string; to: "on" | "off" } | undefined {
  const state = webPressChosenState(node, before, after, handle);
  if (state === undefined || handle === undefined || state.chosenBefore === state.chosenAfter) return undefined;
  return { key: handle, to: state.chosenAfter ? "on" : "off" };
}
