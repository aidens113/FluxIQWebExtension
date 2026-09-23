// Whether a link's address is worth carrying, or only repeats the page it is
// on.
//
// ## The defect this closes
//
// The evidence packet publishes a link as its origin and pathname and never its
// query, because a query is where session tokens, invitation codes and one-time
// links live (`domain/src/runtime/llm-evidence/location.ts`). For a link back to
// the page it sits on, that leaves a byte-for-byte copy of the packet's own
// `location` field -- on every such link.
//
// Measured on the everything store's search page with the real content script
// in headless Chromium and the real domain sanitizer (2026-09-23): of the
// thirty-two elements the packet described, twenty-two carried the identical
// 58-byte string `http://…/scenarios/everything-store/s`. That is 1,320 bytes
// of a 6,000-byte budget -- 22% of everything the model is given -- spent
// telling it where it already knows it is. The crossborder marketplace spent
// 1,368 bytes the same way, the big-box retailer 620 and the job board 448.
//
// And it is not merely redundant. A facet link's real destination *is* its
// query; with the query stripped, the address published is the wrong one, and
// it is published on the twenty-two elements whose whole purpose is that they
// go somewhere different from each other. t100 measured a filter being ranked
// out of a packet that was already full. This is what it was full of.
//
// ## Why nothing is lost
//
// **The full address is still on the wire.** `describeElement` puts the `href`
// attribute the author wrote into the descriptor's `attributes` as well, query
// included -- which the packet's copy never had. Recorded web state
// (`domain/src/recording/web-state/state-values.ts`), the element fingerprint
// (`domain/src/output-nodes/targets/targets.ts`) and every other reader of the
// snapshot still has the real destination. Only the packet's stripped duplicate
// goes.
//
// **And the element must already be named some other way.** An `href` is the
// last identity a descriptor falls back on: `state-values.ts` labels an element
// by it once name, text and value are absent, and `element/selection.ts` keeps
// an element in web state for it alone. So a link known by nothing else keeps
// its address even where that address repeats the page. Measured across four
// campaign sites, every link this drops is named by its own words as well.
//
// **A link that genuinely goes elsewhere is untouched.** The store's logo, a
// product's detail page, a link to another origin: the address differs from
// this document's, so it is published exactly as before, and two links that
// differ still read differently in the packet.

import { addressesThisDocument } from "./controls";
import { meaningfulText } from "../element-traits";
import type { DomElementDescriptor } from "../types";

/**
 * Whether this descriptor's `href` would say only what its reader already
 * knows: the page it is on.
 *
 * Asked where the descriptor is assembled (`../dom-snapshot.ts`), which drops
 * the field when it holds. The element is passed alongside because the address
 * is resolved from the element -- `addressesThisDocument` reads the same
 * `href` property the browser resolved -- while "named some other way" has to
 * be read from the descriptor, since what travels is what matters.
 */
export function repeatsTheDocumentAddress(element: Element, descriptor: DomElementDescriptor): boolean {
  if (descriptor.href === undefined) return false;
  const named = descriptor.accessibleName ?? descriptor.name ?? descriptor.label ?? descriptor.text ?? descriptor.visibleText;
  return meaningfulText(named) && addressesThisDocument(element);
}
