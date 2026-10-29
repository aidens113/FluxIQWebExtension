// Whether a press cleared a layer that covered the page, and which (t787 fix 1
// of `run-mvskptb1-c9cef4fe`): the output `layerCleared` of a press node.
//
// A build that meets a layer over the page while it explores closes it and
// carries on, and a site may remember that close: every later trial ran with
// the layer already gone, so nothing a trial showed said the Flow depends on
// it, and the Flow met the layer again on a fresh account and failed. Only the
// press itself shows what it did: on the look before it a layer covered
// controls (the page view's `COVERING <layer> covers N`) and the pressed
// control belonged to that layer; on the look after it, the same page, the
// layer covers nothing or is gone, and the control the press used is no longer
// shown. So the press says so, and Core makes the Flow do the same whenever the
// layer is there again (`AS/runtime/flow-bootstrap/explored-interruptions.ts`).
//
// What it says is `signature`, an opaque JSON object Core never reads inside
// -- the layer's and the control's kind, role and accessible name, never a
// locator, since it is shown to the model with the rest of the answer -- and
// `control`, the handle the press used. A layer this build's own press opened
// (`../own-layers/memory.ts`) is a step of the Flow, not an interruption, and
// is not reported. Nor is a press whose control is still shown after it: the
// Flow would press it again whenever it shows, which on a control that stays
// is a second press of something already done.

import type { JsonObject } from "fluxiq/core";
import { canonicalWebLlmTargetHandle } from "../../handle-spelling";
import type { WebLlmEvidenceElement } from "../../elements";
import type { WebLlmPageEvidence, WebLlmSnapshotBinding } from "../../sanitize";
import type { WebRunnableNode } from "../catalog";
import { webInLayer } from "../layer";
import { webMovesThePage } from "../start-location";

/** The press node, by the id the catalog gives it. */
const PRESS_NODE_ID = "web.output.dom-click";

/** The `layerCleared` output of a press, or `undefined`. */
export type WebPressClearedLayer = { signature: JsonObject; control: string };

/**
 * The layer the press of `handle` cleared (header): one that covered controls
 * on `before`, held the pressed control, is not `own`, covers nothing on
 * `after` -- the same page -- and whose pressed control `after` no longer shows.
 */
export function webPressClearedLayer(
  node: WebRunnableNode,
  before: WebLlmSnapshotBinding | undefined,
  after: WebLlmSnapshotBinding | undefined,
  handle: string | undefined,
  own: (layer: string) => boolean = () => false
): WebPressClearedLayer | undefined {
  const target = canonicalWebLlmTargetHandle(handle);
  if (node.definitionId !== PRESS_NODE_ID || webMovesThePage(node) || target === undefined) return undefined;
  if (before === undefined || after === undefined || before.evidence.location !== after.evidence.location) return undefined;
  const byHandle = new Map(before.evidence.elements.map((element) => [element.target, element] as const));
  const control = byHandle.get(target);
  if (control === undefined || shown(after.evidence, target)) return undefined;
  const cleared = (before.evidence.blockedBy ?? []).find((blocker) => {
    const layer = blocker.target;
    if (layer === undefined || own(layer) || covering(before.evidence, layer) === 0) return false;
    const holds = layer === target || control.inDialog === layer || webInLayer(byHandle, control, layer);
    return holds && covering(after.evidence, layer) === 0;
  });
  if (cleared?.target === undefined) return undefined;
  const layer = byHandle.get(cleared.target);
  return {
    signature: {
      layer: described(layer, { kind: cleared.kind ?? layer?.kind ?? layer?.isDialog?.kind, role: cleared.role }),
      control: described(control, {})
    },
    control: target
  };
}

/** How many controls the layer `layer` covers on `page`, as the page view's `COVERING` line counts them; 0 when it is not listed. */
function covering(page: WebLlmPageEvidence, layer: string): number {
  const blocker = (page.blockedBy ?? []).find((entry) => entry.target === layer);
  if (blocker === undefined) return 0;
  const cover = page.elements.find((element) => element.target === layer);
  return blocker.blocks ?? cover?.coversCount ?? cover?.covers?.length ?? 0;
}

/** Whether `page` shows the element `handle`: it is there and not hidden. */
function shown(page: WebLlmPageEvidence, handle: string): boolean {
  const element = page.elements.find((candidate) => candidate.target === handle);
  return element !== undefined && element.hidden !== true;
}

/** An element as the signature describes it: its tag, role, kind and accessible name, each only where there is one. */
function described(element: WebLlmEvidenceElement | undefined, extra: { kind?: string | undefined; role?: string | undefined }): JsonObject {
  const role = extra.role ?? element?.role ?? element?.implicitRole;
  const fields: Record<string, string | undefined> = { tag: element?.tag, role, kind: extra.kind, name: element?.name };
  return Object.fromEntries(Object.entries(fields).filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== ""));
}
