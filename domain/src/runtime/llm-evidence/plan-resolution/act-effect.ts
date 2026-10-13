// What one act of exploration made true on the page, as the step a Flow saves
// for it keeps it (t447, `r4b-coupon-step-identity.md` F2).
//
// t442 saves a control exploration acted on as the act found it ("Get coupons"),
// so what the act changed -- "Collected" in its place, a count gone up -- is
// the step's effect and never its identity. This is that effect, in the form a
// Flow node already keeps one (`routeSignatures.effect`): the host's own
// `signRouteEffect` over the route states either side of the act
// (`../../route-state/effect/sign.ts`), read off the very captures the act was
// made from and left, which are the route states Core's `observeRouteState`
// reads from the same page (`../state-digest/snapshot-states.ts`). So a run
// that cannot find the saved control asks `routeEffectHolds` of exactly what
// the build recorded, and passes over a step whose effect the page already
// shows (Core's state routing, `effect_holds`) instead of failing it.
//
// Hashes only, as every effect is: no page text, no selector, nothing of the
// control's identity. An effect is kept only when the act added something the
// page can show, because one that added nothing never holds and would only
// ride along unread.
//
// What the page changes by itself is left out (t496, `./self-changing/`):
// `selfChanging` is what the build saw this page change with nothing done to it.
// An act that added only such names keeps its effect as it was signed.

import type { JsonObject } from "fluxiq/core";
import { webAutomationRouteEffect } from "../../route-state/effect";
import type { WebLlmSnapshotBinding } from "../sanitize";

/** The effect of an act made from the page `before` showed and leaving the page `after` shows, or nothing when it changed nothing the page can show. */
export function webPlanActEffect(before: Pick<WebLlmSnapshotBinding, "routeState">, after: Pick<WebLlmSnapshotBinding, "routeState"> | undefined, selfChanging?: ReadonlySet<string>): JsonObject | undefined {
  if (before.routeState === undefined || after?.routeState === undefined) return undefined;
  const effect = webAutomationRouteEffect(before.routeState, after.routeState, selfChanging);
  return Array.isArray(effect.added) && effect.added.length > 0 ? effect : undefined;
}
