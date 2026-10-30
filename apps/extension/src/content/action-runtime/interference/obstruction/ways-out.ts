// The ways out of a layer, each with what pressing it would do (CC7, interface
// I2): every painted pressable control on the layer, its intent
// (`../way-out.ts` `wayOutIntent`) and its durable target (`./control-ref.ts`).
//
// Ordered so a reader that presses the first it likes gets the best one:
// `dismiss` before `neutral` before `accept`, each group in page order, and at
// most `WAYS_MAX` of them. A link that leaves the document and a disabled
// control are no way out and are left out. A layer that asks for what only a
// person can give (`../pressable-way-out.ts`: a robot check, a credential, a
// payment) lists none: the client will not offer a press of it to anyone.

import type { WebAutomationObstructionWayOut } from "@fluxiq-web-extension/domain/client";
import { isSensitiveFormControl } from "../../../element-traits";
// Past the evidence barrel on purpose: it leads back here through `evidence/dialogs.ts`.
import { isDrawnControl } from "../../../evidence/controls";
import { composedDescendants } from "../../../shadow-dom";
import { challengeIn } from "../../challenge-evidence";
import { wayOutIntent, type WayOutIntent } from "../way-out";
import { controlRefOf } from "./control-ref";

/** At most this many ways out are reported for one layer (interface I2). */
const WAYS_MAX = 6;
/** At most this many of a layer's elements are read; the same bound the way-out scan uses. */
const SCAN_LIMIT = 400;

const PRESSABLE_SELECTOR = [
  "button", "a[href]", "summary",
  'input[type="button"]', 'input[type="submit"]', 'input[type="reset"]',
  '[role="button"]', '[role="link"]', '[role="menuitem"]'
].join(",");

/** A way out of a layer: the control itself, what pressing it would do, and its durable target. */
export type LayerWayOut = { control: Element; intent: WayOutIntent; way: WebAutomationObstructionWayOut };

const ORDER: Readonly<Record<WayOutIntent, number>> = { dismiss: 0, neutral: 1, accept: 2 };

/** The ways out of `layer`, best first; none for a layer only a person can answer. */
export function layerWaysOut(layer: Element): LayerWayOut[] {
  if (challengeIn(layer, "dialog")) return [];
  const found: LayerWayOut[] = [];
  let read = 0;
  for (const element of composedDescendants(layer)) {
    if (++read > SCAN_LIMIT) break;
    if (element.getClientRects().length === 0) continue;
    if (!(element.matches(PRESSABLE_SELECTOR) || isDrawnControl(element))) continue;
    if (isSensitiveFormControl(element)) continue;
    const intent = wayOutIntent(layer, element);
    if (intent === undefined) continue;
    const controlRef = controlRefOf(element);
    found.push({ control: element, intent, way: { intent, ...(controlRef ? { controlRef } : {}) } });
  }
  return found
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => ORDER[a.entry.intent] - ORDER[b.entry.intent] || a.index - b.index)
    .slice(0, WAYS_MAX)
    .map(({ entry }) => entry);
}
