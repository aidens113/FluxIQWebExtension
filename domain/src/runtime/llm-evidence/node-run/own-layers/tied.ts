// Whether a layer new after an act is tied to the control the act was on, by
// what the capture already holds (`./opened-by.ts`). Two ties, each read off
// the page and never off the layer's words:
//
// - **Named.** The control names the layer, or an element the layer holds, by
//   id: `aria-controls` and `aria-owns` say which popup a control drives, and
//   `aria-activedescendant` which option inside it is current. A combobox's
//   suggestion list is tied to its field this way wherever the page wrote it.
// - **Anchored.** The layer is drawn at the control's edge: it starts where the
//   control ends, or ends where it starts, within the control's own height, and
//   shares some of its width -- how a suggestion list, a date picker or a menu
//   hangs from what opened it when the page wrote no relation. A layer standing
//   over the control (one whose box holds its middle, or that the capture says
//   covers it) is a cover, not anchored to it: a backdrop holds the whole page.
//
// A layer that is neither came up beside the act, not out of it, as far as the
// page shows.

import type { WebLlmEvidenceElement } from "../../elements";
import type { WebLlmPageEvidence } from "../../sanitize";
import { attributeRecord } from "../../attributes";
import { webLayerHolds } from "./held-by";

/** The attributes by which a control names what it drives, each a list of ids. */
const NAMING = ["aria-controls", "aria-owns", "aria-activedescendant"];

type Box = NonNullable<WebLlmEvidenceElement["box"]>;

/** Whether the layer `layer` on `after` is tied to `control` (the acted control as `after` shows it, else as `before` did). */
export function webLayerTiedToControl(after: WebLlmPageEvidence, control: WebLlmEvidenceElement, layer: string): boolean {
  const byHandle = new Map(after.elements.map((element) => [element.target, element] as const));
  return named(after, byHandle, control, layer) || anchored(byHandle.get(layer), control, layer);
}

function named(after: WebLlmPageEvidence, byHandle: ReadonlyMap<string, WebLlmEvidenceElement>, control: WebLlmEvidenceElement, layer: string): boolean {
  const attributes = attributeRecord(control.attributes ?? []);
  const ids = new Set(NAMING.flatMap((name) => (attributes[name] ?? "").split(/\s+/u)).filter((id) => id !== ""));
  if (ids.size === 0) return false;
  return after.elements.some((element) => {
    const id = attributeRecord(element.attributes ?? []).id;
    return id !== undefined && ids.has(id) && (element.target === layer || webLayerHolds(byHandle, element, layer));
  });
}

function anchored(layerElement: WebLlmEvidenceElement | undefined, control: WebLlmEvidenceElement, layer: string): boolean {
  const outer = layerElement?.box;
  const inner = control.box;
  if (!outer || !inner || !drawn(outer) || !drawn(inner) || control.coveredBy?.includes(layer) || holdsMiddle(outer, inner)) return false;
  const shared = Math.min(outer.x + outer.width, inner.x + inner.width) - Math.max(outer.x, inner.x);
  if (shared <= 0) return false;
  const below = outer.y - (inner.y + inner.height);
  const above = inner.y - (outer.y + outer.height);
  return Math.abs(below) <= inner.height || Math.abs(above) <= inner.height;
}

function drawn(box: Box): boolean {
  return box.width > 0 && box.height > 0;
}

function holdsMiddle(outer: Box, inner: Box): boolean {
  const x = inner.x + inner.width / 2;
  const y = inner.y + inner.height / 2;
  return x >= outer.x && x <= outer.x + outer.width && y >= outer.y && y <= outer.y + outer.height;
}
