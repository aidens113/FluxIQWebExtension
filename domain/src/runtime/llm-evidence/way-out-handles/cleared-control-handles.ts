// The handle a trial's pressed way out is named by (t470).
//
// Lane D round 8 (`run-mv5jnc5m-a47c3e59`, t465 defect 2): the clearing closed
// the site's slow-down notice by its OK during a trial, and the model, told to
// add a step closing the notice, had never been shown that OK. It wrote the
// step against the only close-like handle it knew, the chat's "Close chat".
//
// So Core hands back, for the Flow being built, the references the dispatcher
// kept each pressed way out under (`../../../cleared-way-outs/`), and this names
// each by a handle of this Flow. The way out is described as one capture of its
// page would describe it -- the same sanitizer, with its address on the page
// the client reported -- and numbered by the Flow's stable handles, so a later
// capture of that page with the notice up gives the control the same handle. It
// is then remembered as a look the capture cut short, which only adds: the
// handle joins its page's and the view history, and the line it prints counts
// as printed, so a candidate step naming it resolves to that control. Nothing
// it describes is shown to the model but the handle.
//
// A reference neither this process nor the Flow's durable record still keeps, or a way out that does not describe exactly
// one element, is left out: the trial feedback then names no handle, and the
// script format asks for no step closing the layer.

import type { WebAutomationClearedWayOuts } from "../../../cleared-way-outs";
import { sanitizeWebLlmSnapshotWithBindings, type WebLlmSnapshotBinding } from "../sanitize";
import type { WebLlmStableHandleScope } from "../stable-handles";

export type WebLlmClearedControlHandlesInput = { projectId: string; flowId: string; wayOuts: readonly string[] };

/**
 * Names each way out in `wayOuts` by a handle of the Flow `projectId`/`flowId`:
 * `stable` numbers a one-element capture of it, and `remember` keeps that
 * capture as a cut-short look of its page.
 */
export function webLlmClearedControlHandles(dependencies: {
  wayOuts: WebAutomationClearedWayOuts;
  stable(scope: WebLlmStableHandleScope, binding: WebLlmSnapshotBinding): WebLlmSnapshotBinding;
  remember(scope: WebLlmStableHandleScope, binding: WebLlmSnapshotBinding): void;
}): (input: WebLlmClearedControlHandlesInput) => Promise<Record<string, string>> {
  return async ({ projectId, flowId, wayOuts }) => {
    const scope = { projectId, flowId };
    const handles: Record<string, string> = {};
    for (const reference of new Set(wayOuts)) {
      // Kept by this process, or, after a restart, in the Flow's durable record (`../../../cleared-way-outs/registry.ts`, t728).
      const wayOut = await dependencies.wayOuts.find(reference, scope);
      if (wayOut === undefined) continue;
      let described: WebLlmSnapshotBinding;
      try {
        described = sanitizeWebLlmSnapshotWithBindings({ url: wayOut.url, interactiveElements: [wayOut.element], truncated: true });
      } catch {
        /* best-effort: a way out the sanitizer refuses is named by no handle, and the feedback then asks for no step */
        continue;
      }
      if (described.evidence.elements.length !== 1) continue;
      const numbered = dependencies.stable(scope, described);
      dependencies.remember(scope, numbered);
      const handle = numbered.evidence.elements[0]?.target;
      if (handle !== undefined) handles[reference] = handle;
    }
    return handles;
  };
}
