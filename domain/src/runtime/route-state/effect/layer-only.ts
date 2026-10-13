// The hashes, as a step's effect is made of them (`../page-features.ts`), of the
// control names a page shows only inside some of its layers (t499): the names
// `layer` lists that `elsewhere` does not. The signer (`./sign.ts`) leaves them
// out of what an act added when the layers are ones the page raised by itself.
//
// It hashes names and decides nothing. Which layers the page raised, and which
// controls sit in them, the capture says, and its reader does
// (`../../llm-evidence/plan-resolution/self-changing/page-raised.ts`). A name
// the page also shows outside those layers is the page's, and is not returned.
//
// Names are read as the route state lists them: joined by its separator, so a
// name is normalised and hashed exactly as a `page.controls` entry is.

import { webRoutePageFeatures } from "../page-features";

const LIST_SEPARATOR = " | ";
const NONE: ReadonlySet<string> = new Set();

export function webAutomationRouteLayerOnlyHashes(layer: readonly string[], elsewhere: readonly string[]): ReadonlySet<string> {
  if (layer.length === 0) return NONE;
  const outside = new Set(hashesOf(elsewhere));
  const inside = hashesOf(layer).filter((hash) => !outside.has(hash));
  return inside.length > 0 ? new Set(inside) : NONE;
}

function hashesOf(names: readonly string[]): readonly string[] {
  return webRoutePageFeatures({ page: { controls: names.join(LIST_SEPARATOR) } }).controlHashes;
}
