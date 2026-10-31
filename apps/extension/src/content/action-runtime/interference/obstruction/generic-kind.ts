// What a layer is, in the generic words Core reads (CC7, interface I1): the
// extension's classifiers name a consent wall and a rate-limit notice
// (`layer-kind.ts`); everything else -- a promotion, a newsletter modal, any
// dialog no classifier named -- is `other`. Consent is `overlay`. The domain's
// `notice` and `assistant` are reserved: nothing here recognises either, and a
// kind that is guessed is worse than `other`.

import type { WebAutomationClearedLayerKind } from "@fluxiq-web-extension/domain/client";
import { layerKind } from "../layer-kind";

/** The generic kind of `layer`. A robot check is never cleared, and is `other` here. */
export function genericLayerKind(layer: Element): WebAutomationClearedLayerKind {
  const kind = layerKind(layer);
  if (kind === "consent") return "overlay";
  if (kind === "rate_limit") return "rate_limit";
  return "other";
}
