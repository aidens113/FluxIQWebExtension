// The signatures a Flow has learned from presses of controls that show their
// state in their words or class (CC9, interface I5): `learned` with `signature`
// added as the newest, at most `LEARNED_TOGGLES_PER_FLOW` of them. A signature
// that gains or loses nothing is no toggle and is not learned; neither is one a
// control states for itself (`via: "attribute"`), which needs no learning.

import type { WebToggleSignature } from "../../../../actions/toggle-signature";

/** Signatures one Flow learns; the one learned longest ago goes first. */
const LEARNED_TOGGLES_PER_FLOW = 16;

export function webPlanLearnedToggles(learned: readonly WebToggleSignature[], signature: WebToggleSignature): WebToggleSignature[] {
  if (signature.via === "attribute" || signature.gains.length === 0 || signature.loses.length === 0) return [...learned];
  const key = JSON.stringify(signature);
  return [...learned.filter((known) => JSON.stringify(known) !== key), signature].slice(-LEARNED_TOGGLES_PER_FLOW);
}
