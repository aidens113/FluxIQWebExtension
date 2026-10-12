// The target handles of one packet, alone, for a step a repair wrote (t429).
//
// A repair's model is shown the failure packet and the packets its
// exploration returned, each numbered on its own, and none of them is a view
// of the build (`./target-packets.ts` keeps those, per Flow). So a step it
// writes -- a handler's body, a unit's replacement, steps inserted before a
// node -- names a handle that means something in exactly one packet, which
// Core hands back with the step (`handleEvidence`) the way it hands a target
// override's packet to `validateTargetOverrideEvidence`. This is that packet
// as the store a plan node resolves against: the same reading of each element
// (the full identity, `./element-identity.ts`), the same rules for a shared
// selector, and nothing any other packet showed. The step is then held to
// everything a build's step is, the identity guard included
// (`./identity-guard.ts`).

import type { WebLlmSnapshotBinding } from "../sanitize";
import { createWebLlmTargetPackets, type WebLlmTargetPackets, type WebLlmTargetScope } from "./target-packets";

/** A store holding `binding`'s handles and no others, for one resolution. */
export function webLlmPacketTargets(scope: WebLlmTargetScope, binding: WebLlmSnapshotBinding): WebLlmTargetPackets {
  const targets = createWebLlmTargetPackets();
  targets.remember(scope, binding);
  return targets;
}
