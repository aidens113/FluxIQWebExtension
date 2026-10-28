// Whether a press that changed nothing through its wait may be made once more
// here, by this domain, before it is reported (t778, replacing t513).
//
// **The rule (supervisor, t778):** a press is repeated only after a fresh read
// shows the first press had no effect; an undo or a toggle whose effect is
// uncertain is never pressed again blindly -- read first; a control the page
// ignores on its first press still gets its second press when the fresh read
// confirms nothing happened.
//
// This domain's read is the page as it draws itself, and that is not enough
// to say a lasting act did not happen. The job board's My jobs commits an
// Unsave on its server, repaints the heart and keeps the row until the page
// loads again; its notice already read "Removed from saved jobs" from the undo
// before. t513 counted "nothing changed, the control still there and enabled"
// as certain, pressed that undo a second time and saved the job again (rerun
// round 6 slot 2, `run-mvrj7qg9-b6dc94f6`, t772 w11). The read that can say a
// lasting press was ignored is the extension's: it watches the press for a
// request, a navigation, a focus move and a change in the control's section,
// presses once more itself when none came, and answers a press that settled
// exactly as it was `web.action.no_effect`, `certainNoEffect`, which Core's
// retries make once more (`apps/extension/src/content/actions/click.ts`, t517)
// -- social's Post. A press that reaches here was answered by the page in
// some way the extension saw. So:
//
// - a press whose call declared a lasting consequence is never made again
//   here: it is said to be uncertain, and read again first;
// - neither is a press on a control whose own state a press flips -- pressed,
//   checked, open or closed -- whatever its call declared: one that landed
//   unseen would be turned back;
// - any other press -- a "Load more" that took the first press as a wake-up --
//   is made once more, as t511 made it.

import type { WebLlmEvidenceElement } from "../../elements";
import type { WebLlmSnapshotBinding } from "../../sanitize";

/** The attributes by which a control says it holds a state its press flips. */
const FLIPPED_STATES: readonly string[] = ["aria-pressed", "aria-checked"];

/** True where the press on `handle`, unchanged on `page` through its wait, may be made once more here. */
export function webPressMayRepeat(page: WebLlmSnapshotBinding | undefined, handle: string | undefined, lasting: boolean): boolean {
  if (lasting) return false;
  const control = handle === undefined ? undefined : page?.evidence.elements.find((element) => element.target === handle);
  return control === undefined || !holdsFlippedState(control);
}

/** Whether the control shows a state of its own that a press turns over: pressed or not, checked or not, open or closed. */
function holdsFlippedState(control: WebLlmEvidenceElement): boolean {
  if (control.checked !== undefined || control.expanded !== undefined) return true;
  return (control.attributes ?? []).some(([name]) => FLIPPED_STATES.includes(name.toLowerCase()));
}
