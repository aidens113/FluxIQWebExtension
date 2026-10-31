// A layer as the obstruction a result reports (CC7, interface I2): its generic
// kind, stable id and accessible name, and its ways out with their intents and
// durable targets. The client reports what is there; it never decides which to
// press -- Core presses the first `dismiss`, else `neutral`, never `accept`.

import type { WebAutomationObstruction } from "@fluxiq-web-extension/domain/client";
import { accessibleNameFor } from "../../../identity";
import { genericLayerKind } from "./generic-kind";
import { layerId } from "./stable-id";
import { layerWaysOut } from "./ways-out";

/** The longest layer name that travels; the domain bounds it again. */
const NAME_MAX = 120;

/** `layer` as an obstruction. Never throws: it annotates a refusal, and a refusal must still be reported. */
export function layerObstruction(layer: Element): WebAutomationObstruction | undefined {
  let obstruction: WebAutomationObstruction | undefined;
  try {
    const name = (accessibleNameFor(layer) ?? "").replace(/\s+/gu, " ").trim().slice(0, NAME_MAX);
    obstruction = {
      id: layerId(layer),
      ...(name ? { name } : {}),
      kind: genericLayerKind(layer),
      dismiss: layerWaysOut(layer).map(({ way }) => way)
    };
  } catch {
    /* best-effort: a layer that cannot be read is not reported, and the refusal it annotates still is */
  }
  return obstruction;
}
