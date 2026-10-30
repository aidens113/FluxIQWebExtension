// An opaque id for a layer, stable across visits (CC7, interface I1).
//
// A Flow that learned to close a layer must recognise the same layer on its
// next visit, and the layer's own words are not stable: a rate-limit notice
// counts seconds down, a promotion names a price. So the id is a hash of the
// layer's **structure** only -- its role, its tag, its accessible name with
// every digit left out, and the accessible names of the controls on it, sorted
// -- and carries no word of the page. Two visits to one layer give one id; a
// consent sheet and a newsletter modal give two.

import { accessibleNameFor } from "../../../identity";
import { layerWaysOut } from "./ways-out";

/** At most this many control names go into the hash. */
const NAMES_MAX = 6;

/** The layer's id: `layer:` and eight hex digits of a 32-bit FNV-1a hash of its structure. */
export function layerId(layer: Element): string {
  const role = (layer.getAttribute("role") ?? "").trim().toLowerCase();
  const structure = [
    role,
    layer.tagName.toLowerCase(),
    stable(accessibleNameFor(layer)),
    ...layerWaysOut(layer).map(({ control }) => stable(accessibleNameFor(control) ?? control.textContent)).filter((name) => name !== "").sort().slice(0, NAMES_MAX)
  ].join("\u001f");
  return `layer:${fnv1a(structure)}`;
}

/** A name as structure: lowercase, collapsed, digits out, so a count or a price does not change it. */
function stable(name: string | null | undefined): string {
  return (name ?? "").toLowerCase().replace(/\d+/gu, "").replace(/\s+/gu, " ").trim().slice(0, 80);
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
