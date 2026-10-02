// Whether a recorded route signature (`./signature.ts`) is the page observed
// now, and how close the two are -- Core's `compareRouteSignatures` (t243).
//
// Two signatures match when all three hold:
//
//   - the layers in front of the page are the same, so a popup step's page is
//     never the page without the popup;
//   - the path shapes are the same;
//   - the control sets overlap by at least a half.
//
// `closeness` is that overlap, the Jaccard index of the two control sets as
// the bottom-k sketches estimate it: take the 64 smallest hashes of the union
// and count the share of them both sides hold. A hash among the 64 smallest of
// the union is among the 64 smallest of each side that has it, so a sketch
// answers for it truthfully. When neither page had more than 64 controls each
// sketch is the whole set, the union is taken whole, and the answer is exact.
// Two empty sets are the same set (1); an empty set against a non-empty one
// shares nothing (0).
//
// A signature that is not `web-route.v1` -- written under another rule, or not
// a signature at all -- never matches.

import type { JsonObject } from "fluxiq/core";
import { WEB_ROUTE_SIGNATURE_FORMAT } from "./signature-format";

const MATCH_CLOSENESS = 0.5;

type RouteSignature = { path: string; layers: string; controls: ReadonlySet<string>; complete: boolean };

export function compareWebAutomationRouteSignatures(recorded: JsonObject, observed: JsonObject): { matches: boolean; closeness: number } {
  const before = parsed(recorded);
  const now = parsed(observed);
  if (before === undefined || now === undefined) return { matches: false, closeness: 0 };
  const closeness = estimatedJaccard(before, now);
  return { matches: before.layers === now.layers && before.path === now.path && closeness >= MATCH_CLOSENESS, closeness };
}

function estimatedJaccard(left: RouteSignature, right: RouteSignature): number {
  if (left.controls.size === 0 && right.controls.size === 0) return 1;
  if (left.controls.size === 0 || right.controls.size === 0) return 0;
  const union = [...new Set([...left.controls, ...right.controls])].sort();
  const sample = left.complete && right.complete ? union : union.slice(0, WEB_ROUTE_SIGNATURE_FORMAT.sketchSize);
  const shared = sample.filter((hash) => left.controls.has(hash) && right.controls.has(hash)).length;
  return shared / sample.length;
}

function parsed(signature: JsonObject): RouteSignature | undefined {
  if (signature.v !== WEB_ROUTE_SIGNATURE_FORMAT.version) return undefined;
  const { path, layers, controls, count } = signature;
  if (typeof path !== "string" || typeof layers !== "string" || typeof count !== "number" || !Array.isArray(controls)) return undefined;
  if (!controls.every((hash): hash is string => typeof hash === "string")) return undefined;
  return { path, layers, controls: new Set(controls), complete: count <= WEB_ROUTE_SIGNATURE_FORMAT.sketchSize };
}
