// Whether a press that changed nothing certainly did not happen, so a press
// whose call declared a lasting consequence may be made once more (t513).
//
// **The user's rule (2026-10-07):** every node retries automatically; only a
// lasting act whose effect is uncertain is held back. **The supervisor's
// reading of it (t513):** a press is not uncertain when the bounded wait after
// it showed nothing changed at all, the pressed control is still there --
// shown and enabled -- and the form or dialog it sits in is still open. It did
// not happen, and pressing it once more is not a second act. The social gate's
// Post button (`run-mv6v2jh4-69244ffb`) spun for a moment on its first press,
// changed nothing, and posted on the second; t511 held that second press back
// because the call declared `send_or_publish`, and no path could make it.
//
// The caller asks this only of a press `./no-effect.ts` already judged: both
// looks seen whole, the one after not loading, and the page the same in every
// respect but where it is drawn. What is added here is the control itself, read
// on the look after: present by its handle, not hidden, not disabled as the page
// view prints it, and every element it sits in -- its form, its dialog --
// present and shown. Anything that cannot be read so (no handle, a control
// gone) is not certain, and the press stays held back.

import { webLlmElementKind, webLlmStateTokens } from "../../page-view";
import type { WebLlmSnapshotBinding } from "../../sanitize";

/** True where the press on `handle` certainly did not happen, read on `after`, the look the wait ended on. */
export function webPressCertainlyIgnored(after: WebLlmSnapshotBinding | undefined, handle: string | undefined): boolean {
  if (after === undefined || handle === undefined) return false;
  const byHandle = new Map(after.evidence.elements.map((element) => [element.target, element]));
  const control = byHandle.get(handle);
  if (control === undefined || control.hidden === true) return false;
  if (webLlmStateTokens(control, webLlmElementKind(control), undefined).includes("disabled")) return false;
  // Every element it sits in -- the form it submits, the dialog it answers -- still there and shown.
  const seen = new Set<string>([handle]);
  for (let at = control.parent; at !== undefined; ) {
    if (seen.has(at)) return false;
    seen.add(at);
    const holder = byHandle.get(at);
    if (holder === undefined || holder.hidden === true) return false;
    at = holder.parent;
  }
  return true;
}
