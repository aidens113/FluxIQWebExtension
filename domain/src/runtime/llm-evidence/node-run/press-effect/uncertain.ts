// The sentence for a press the page answered but has not shown, which was not
// pressed a second time (`./repeat-press.ts`, t778).
//
// It is not "no effect" (`./no-effect.ts`): the extension saw the page answer
// the press, and a site may keep what it shows until it loads again -- the job
// board's My jobs keeps an unsaved row, with its notice already showing from
// the undo before. Telling the model the press did nothing invites the second
// press this module was written to prevent. So it says what is known -- the
// page drew no change -- and what to do before pressing again: read where the
// effect would show, loading the page again where it may draw it only then.

import { webPressedControlWords } from "./press-words";
import type { WebLlmSnapshotBinding } from "../../sanitize";

/** The sentence for a press on `handle` that the page answered and did not draw. */
export function webPressUncertain(before: WebLlmSnapshotBinding | undefined, handle: string | undefined): string {
  const control = webPressedControlWords(before, handle);
  return [
    `${control.charAt(0).toUpperCase()}${control.slice(1)} was pressed once and the page has drawn no change yet: no line appeared or went, and none changed its words, value or state.`,
    "That does not show the press did nothing: a site may keep what it shows until the page loads again, so it was not pressed a second time, which could do it twice or turn it back.",
    "Before pressing it again, read again where its effect would show -- load this page again, or read the list or control it changes -- and press it again only if that read shows it did not happen."
  ].join(" ");
}
