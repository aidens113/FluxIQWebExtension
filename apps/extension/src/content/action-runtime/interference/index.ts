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
// `../rate-limit-notice.ts`, which asks whether a press was refused as too fast.

export { clearInterference } from "./clear";
export { coveringLayerSentence } from "./covering-layer";
export { overlaysAt, overlaysOverPage } from "./overlays";
export { boundedLayerText } from "./layer-text";
export { dismissControlIn, hasDismissalControl } from "./way-out";
export { isDismissalLabel, isRateLimitLayerText, DISMISS_LABEL_MAX } from "./vocabulary";

export type { Point } from "./overlays";
