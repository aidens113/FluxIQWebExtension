// A handle the page as it is now still gives to an element binds to that element (page-diff D2; t1036, t1042).
//
// Under stable handles an element keeps its handle across the captures, views and pages of one run, and a handle is
// never given to anything else (`../stable-handles.ts`). So whichever view printed a handle -- a view of another page,
// one whose selector has since moved, the whole page `core.full_page` showed -- the capture a call has just taken,
// numbered as the run numbers its handles, says whether the handle still names an element: when it prints the handle,
// that element as it is now is the target. Only a handle the page now gives to no element is gone, and its caller
// refuses it as stale.
//
// One check for every path that binds a handle against a capture of its own: a detection (`./detect.ts`) and a
// runtime recovery's press and field entry (`../press.ts`). A node run binds through the packet store, which is handed
// the same numbered capture before it resolves (`../node-run/run.ts`), so a handle that capture prints resolves there.

import type { WebLlmEvidenceElement } from "../elements";
import type { WebLlmSnapshotBinding } from "../sanitize";

/** The element a capture gives a handle to, and the selector it holds for it. */
export type WebLlmHeldElement = { element: WebLlmEvidenceElement; selector: string };

/**
 * The element `now` gives `target` to, with its selector; nothing when `now` gives the handle to no element. `now` must
 * be numbered as the run numbers its handles (restamped), or a handle means nothing in it.
 */
export function webLlmElementHeldNow(now: WebLlmSnapshotBinding, target: string): WebLlmHeldElement | undefined {
  const element = now.evidence.elements.find((candidate) => candidate.target === target);
  const selector = element === undefined ? undefined : now.selectors.get(target);
  return element === undefined || selector === undefined ? undefined : { element, selector };
}
