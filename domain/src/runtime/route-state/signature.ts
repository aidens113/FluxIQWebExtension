// The compact signature a Flow node keeps of the page it started on and the
// page it left (t243), which Core stores on the node and hands back to
// `./compare-signatures.ts` when a step cannot run and the run must find the
// node whose expected pre-state holds now.
//
// It is read off the route state `./project.ts` writes, so it can say nothing
// a Router could not already test, and it holds hashes only: a Flow document
// that carries it carries no page text, no title and no path. It stays well
// inside Core's 2,048-character bound -- 64 hashes of 8 characters at most.
// The names and hashes are `./page-features.ts`'s:
//
//   - `path`: the shape of the path, so two product pages are one place.
//   - `layers`: the dialogs and blockers standing in front of the page, or
//     `""` when there are none, so a popup step's page is never the page
//     without the popup.
//   - `controls`: a bottom-k sketch of the distinct control names -- the 64
//     smallest of their mixed hashes, sorted -- from which the comparator
//     estimates how much of the two pages' controls overlap.
//   - `count`: how many distinct control names there were.

import type { JsonObject } from "fluxiq/core";
import { webRoutePageFeatures } from "./page-features";
import { WEB_ROUTE_SIGNATURE_FORMAT } from "./signature-format";

export function webAutomationRouteSignature(state: JsonObject): JsonObject {
  const features = webRoutePageFeatures(state);
  return {
    v: WEB_ROUTE_SIGNATURE_FORMAT.version,
    path: features.path,
    layers: features.layers,
    controls: features.controlHashes.slice(0, WEB_ROUTE_SIGNATURE_FORMAT.sketchSize),
    count: features.controlCount
  };
}
