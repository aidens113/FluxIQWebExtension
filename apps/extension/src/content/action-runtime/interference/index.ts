// What stands in the way of an action, and how the page's own affordance
// clears it.
//
// `overlays.ts` finds the layers a page is painting over itself, `way-out.ts`
// finds the control inside one that closes it, `vocabulary.ts` decides which
// labels mean "close" and which may never be pressed, and `clear.ts` presses
// them. `blocking-dialog.ts` reads the first three to classify a refusal;
// `recovery/` calls the last to answer one. `covering-layer.ts` only names: the
// layer a covered target is under and the controls on it, for the refusal.

export { clearInterference } from "./clear";
export { coveringLayerSentence } from "./covering-layer";
export { overlaysAt, overlaysOverPage } from "./overlays";
export { dismissControlIn, hasDismissalControl } from "./way-out";
export { isDismissalLabel, DISMISS_LABEL_MAX } from "./vocabulary";

export type { Point } from "./overlays";
