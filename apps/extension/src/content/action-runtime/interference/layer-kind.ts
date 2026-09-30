// What a dialog or a covering layer is, as the extension's own interference
// classifiers already recognise it: carried as `kind` on the layer's dialog or
// blocker entry, so a reader knows a consent wall or a robot check as such on
// the entry that is one (t200).
//
// Until t200 the domain put an open modal's controls at the head of the packet,
// and the snapshot put a painted layer's controls at the head of its element
// list, so a model met the thing in the way first. Nothing is ordered any more;
// what the order implied is said on the layer instead.
//
// Nothing here is a new heuristic. Each kind is one existing classifier asked
// of the layer, the same question the runtime asks before it decides what it
// may press:
//
// - `robot_check`: `robotCheckIn(layer, "dialog")` (`../challenge-evidence.ts`),
//   which `clear.ts` reads to know which layers it must never press through.
//   Either answer -- self-clearing or person-only -- is a robot check.
// - `consent`: `isConsentLayerText` over `boundedLayerText`, as `way-out.ts`
//   asks it before it may decline optional cookies.
// - `rate_limit`: `isRateLimitLayerText` over `boundedLayerText`, as
//   `way-out.ts` and `../rate-limit-notice.ts` ask it.
//
// A robot check is asked first: a check page often links a privacy notice, and
// "privacy" is a consent word, but what stands in the way is the check. Consent
// is asked before the rate limit, in `way-out.ts`'s order.
//
// The contract also names `promotion` and `assistant`. No existing classifier
// recognises either -- the dismissal vocabulary knows how to close a promotion,
// not how to tell one from any other dialog -- so neither is produced here.
//
// It lives here, beside the classifiers, and the evidence producers
// (`../../evidence/dialogs.ts`, `../../evidence/overlays.ts`) ask it through
// this directory's barrel. That makes `evidence/` and this directory import
// each other -- `covering-layer.ts` asks `isDrawnControl` -- and the cycle is
// safe only because each side calls the other inside function bodies and
// reads none of its values while modules are evaluated. Keep it that way.

import { robotCheckIn } from "../challenge-evidence";
import { boundedLayerText } from "./layer-text";
import { isConsentLayerText, isRateLimitLayerText } from "./vocabulary";
import type { LayerKind } from "../../evidence";

/** What the layer is, when an interference classifier recognises it; `undefined` otherwise. */
export function layerKind(layer: Element): LayerKind | undefined {
  if (robotCheckIn(layer, "dialog") !== undefined) return "robot_check";
  const text = boundedLayerText(layer);
  if (isConsentLayerText(text)) return "consent";
  if (isRateLimitLayerText(text)) return "rate_limit";
  return undefined;
}
