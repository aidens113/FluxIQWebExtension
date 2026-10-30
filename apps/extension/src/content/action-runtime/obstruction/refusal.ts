// The obstruction behind a refusal (CC7, interface I2): a target refused as
// `covered` or `hidden` while a layer stands over the page is reported with the
// layer, its kind and id, and the ways out it offers, so Core can learn a
// handler for it without a model naming a control. `blocking-dialog.ts` asks
// which layers count (`interference/overlays.ts`); this adds what the layer is and offers.
//
// For `covered`, the layer at the point the hit test landed on, found as the
// refusal's own sentence finds it (`interference/covering-layer.ts`), else the
// first dialog layer over the page. For `hidden`, the first dialog layer over the
// page that does not hold the target. Nothing is reported when no layer explains
// the refusal. Never throws.

import type { WebAutomationObstruction } from "@fluxiq-web-extension/domain/client";
import { coveringLayerOf, layerObstruction, overlaysAt, type Point } from "../interference";

/** The obstruction that explains a refusal with code `reason`, or `undefined`. */
export function obstructionBehind(reason: string, blockedAt: Point | undefined, target: Element | undefined): WebAutomationObstruction | undefined {
  if (reason !== "covered" && reason !== "hidden") return undefined;
  let obstruction: WebAutomationObstruction | undefined;
  try {
    const covering = reason === "covered" && blockedAt !== undefined && target !== undefined ? coveringLayer(target, blockedAt) : undefined;
    const layer = covering ?? overlaysAt(reason === "covered" ? blockedAt : undefined, target)[0];
    obstruction = layer === undefined ? undefined : layerObstruction(layer);
  } catch {
    /* best-effort: a page whose layers cannot be read reports no obstruction, and the refusal it annotates still stands */
  }
  return obstruction;
}

/** The layer at the blocked point; a page whose hit test cannot be read gives none here, and the declared layers are asked instead. */
function coveringLayer(target: Element, point: Point): Element | undefined {
  let layer: Element | undefined;
  try {
    layer = coveringLayerOf(target, point);
  } catch {
    /* best-effort: the declared layers are asked instead */
  }
  return layer;
}
