// What stands in the way of an action, and how the page's own affordance
// clears it.
//
// `overlays.ts` finds the layers a page is painting over itself, `way-out.ts`
// finds the control inside one that closes it, `vocabulary.ts` decides which
// labels mean "close" and which may never be pressed, and `clear.ts` presses
// them. `blocking-dialog.ts` reads the first three to classify a refusal;
// `recovery/` calls the last to answer one. `covering-layer.ts` only names: the
// layer a covered target is under and the controls on it, for the refusal.
// `layer-text.ts` reads a layer's own bounded words, for `way-out.ts` and for
// `../rate-limit-notice.ts`, which asks whether a press was refused as too fast,
// as busy, or as needing something first.
// `probe-points.ts` says where `overlays.ts` hit-tests the viewport;
// `pressable-way-out.ts` is the one per-layer rule `clear.ts` presses by and
// `presence.ts` asks by, so the recovery can clear a wall a missing target is
// hidden behind.
// `layer-kind.ts` names what a layer is -- a robot check, a consent prompt, a
// rate-limit notice -- for the snapshot's dialog and blocker evidence
// (`../../evidence/`).
// `press-ways-out.ts` is the press loop `clear.ts` counts, and it records each
// press as the layer's kind and the dismissal's word (`control-word.ts`) for
// the action result. `press-guard/` refuses a way out whose press would
// act, and `clearing-target.ts` says which layer is the step's own (t401).

export { clearInterference } from "./clear";
export { pressWaysOut } from "./press-ways-out";
export { clearableLayerOverPage } from "./presence";
export { coveringLayerSentence } from "./covering-layer";
export { overlaysAt, overlaysOverPage } from "./overlays";
export { boundedLayerText } from "./layer-text";
export { layerKind } from "./layer-kind";
export { dismissControlIn, hasDismissalControl } from "./way-out";
export { isDismissalLabel, isPageRequirementText, isRateLimitLayerText, isTransientRefusalText, DISMISS_LABEL_MAX } from "./vocabulary";

export type { Point } from "./overlays";
export type { ClearingTarget } from "./clearing-target";
