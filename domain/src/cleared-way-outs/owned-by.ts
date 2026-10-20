// One registry of pressed ways out per FluxIQ instance (t470), shared by the
// two halves of this domain that meet at it: the output dispatcher, which keeps
// what a client pressed, and the evidence runtime, which names it for a trial
// (`./registry.ts`). Each is handed the instance it serves, so one process
// hosting two instances never mixes their ways out. The registry writes each
// Flow's way outs through to that instance's durable build state
// (`./build-state-source.ts`, t728).

import { webAutomationBuildStateSource } from "./build-state-source";
import { createWebAutomationClearedWayOuts, type WebAutomationClearedWayOuts } from "./registry";

const owned = new WeakMap<object, WebAutomationClearedWayOuts>();

/** The registry of `owner` (a FluxIQ instance), made on first ask. */
export function webAutomationClearedWayOutsOf(owner: object): WebAutomationClearedWayOuts {
  const known = owned.get(owner);
  if (known) return known;
  const made = createWebAutomationClearedWayOuts(webAutomationBuildStateSource(owner));
  owned.set(owner, made);
  return made;
}
