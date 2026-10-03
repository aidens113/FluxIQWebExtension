// Whether a press answered something that stood in front of the page and was
// gone after it (t174, case (2) of the t174-w60 absent-step-routing report).
//
// A build that met a consent wall or a chat popup pressed "Decline optional
// cookies" or "Close chat", and that press became a step of the Flow like any
// other. A playback that met no such layer then failed on it: the control it
// was to press was not there, because the layer it belonged to was not. The
// step was the Flow's answer to an interruption, and only the press itself
// knows that: the look before it shows the control inside a layer, and the
// look after it shows the layer gone. So the step says so (`interruption` on
// the draft statement, `../run.ts`), and Core makes such a step optional.
//
// A layer is what `../layer/element.ts` says it is, and a control is in one
// when the capture placed it in an open modal dialog (`inDialog`), when it is
// the layer itself, or when it belongs to one (`../layer/member.ts`). Said only
// where the two looks are of the same page: a press that took the page
// elsewhere answered whatever it answered by leaving.

import { canonicalWebLlmTargetHandle } from "../../handle-spelling";
import type { WebLlmEvidenceElement } from "../../elements";
import type { WebLlmPageEvidence } from "../../sanitize";
import { webInLayer, webIsLayer } from "../layer";

/**
 * Whether the press of `handle` on `before` answered a layer: the control lay
 * in one there, and on `after` -- the same page -- that layer is gone or no
 * longer stands in front of it. False wherever either look, or the handle, is
 * missing.
 */
export function webAnsweredLayer(
  before: WebLlmPageEvidence | undefined,
  after: WebLlmPageEvidence | undefined,
  handle: string | undefined
): boolean {
  const target = canonicalWebLlmTargetHandle(handle);
  if (before === undefined || after === undefined || target === undefined) return false;
  if (before.location !== after.location) return false;
  const layers = layersHolding(before, target);
  if (layers.length === 0) return false;
  const afterByHandle = new Map(after.elements.map((element) => [element.target, element] as const));
  return layers.some((layer) => !webIsLayer(afterByHandle.get(layer)));
}

/** The handles of the layers the control `target` lay in on `page`. */
function layersHolding(page: WebLlmPageEvidence, target: string): string[] {
  const byHandle = new Map<string, WebLlmEvidenceElement>(page.elements.map((element) => [element.target, element] as const));
  const control = byHandle.get(target);
  if (control === undefined) return [];
  const held: string[] = [];
  if (control.inDialog !== undefined) held.push(control.inDialog);
  if (webIsLayer(control)) held.push(target);
  for (const element of page.elements) {
    if (element.target === target || held.includes(element.target) || !webIsLayer(element)) continue;
    if (webInLayer(byHandle, control, element.target)) held.push(element.target);
  }
  return held;
}
