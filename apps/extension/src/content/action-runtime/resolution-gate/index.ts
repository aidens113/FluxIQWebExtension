// The gate a target resolution puts its matches through before it counts or
// chooses between them (`../resolve-target.ts`): what is visible, enabled and of
// the recorded tag. A match the gate rejects is not a candidate for an action,
// and a tie among such matches alone is not a tie on the page (t642).

export { isVisibleForResolution } from "./visible";
export { passesResolutionGate } from "./passes-gate";
export { isHiddenTie } from "./hidden-tie";
