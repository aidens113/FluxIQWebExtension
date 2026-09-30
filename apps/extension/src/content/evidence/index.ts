// Page-level snapshot evidence: what the page is, rather than what its elements
// are. `dom-snapshot.ts` calls `pageEvidence` once per capture and carries the
// result as the snapshot's `evidence`; every other export here is the module
// that answers one question, exported so a test can ask it directly.
//
// Each item was audited as absent or partial before Phase 1.4: dialogs and
// modals, blocking overlays, loading state, page regions and repeating
// structures had no representation at all, and the forms model, navigation
// state, element change, interaction recency and the truncation totals existed
// only inside the recorder or not as fields anyone downstream could read.
//
// One module here answers about one element rather than about the page, and
// its answer is not carried as a field: `controls.ts` says which elements the
// page drew by hand as controls out of elements the browser makes nothing of,
// which the interference scan asks of what covers a target
// (`action-runtime/interference/covering-layer.ts`).
//
// The snapshot's element list is not ranked any more (t200), so the rules that
// only fed its ranking are gone: which controls change what the page shows,
// which sit in the site's footer, and whether a link's address only repeats the
// page's. Two rules that ranked also carried information, and they are kept as
// facts on each element's own descriptor, in document order and moving
// nothing: `front-layer.ts` marks what is painted over the page
// (`frontLayer`), and `lead-statements.ts` marks the main region's own short
// statements about what it shows (`leadStatement`). What a dialog or a
// covering layer is (`kind`) comes from the interference classifiers
// (`action-runtime/interference/layer-kind.ts`).

export { markElementActivity, forgetElementActivity, type SnapshotElementEntry } from "./changes";
export { isDrawnControl } from "./controls";
export { dialogEvidence } from "./dialogs";
export { formEvidence } from "./forms";
export { frontLayerTest } from "./front-layer";
export { forgetInteractedElements, recentlyInteractedElements, rememberInteractedElement } from "./interactions";
export { isLeadStatement } from "./lead-statements";
export { loadingEvidence } from "./loading";
export { navigationEvidence } from "./navigation";
export { overlayEvidence } from "./overlays";
export { pageEvidence, type SnapshotElementCounts } from "./page";
export { regionEvidence } from "./regions";
export { repeatingEvidence } from "./repeating";

export type {
  DialogEvidence,
  DialogEvidenceItem,
  FormControlEvidence,
  FormEvidence,
  LayerKind,
  LoadingEvidence,
  LoadingIndicator,
  LoadingIndicatorKind,
  NativeDialogEvidence,
  NavigationEvidence,
  OverlayEvidence,
  OverlayEvidenceItem,
  PageEvidence,
  RegionEvidence,
  RepeatingStructureEvidence,
  SnapshotElementTotals
} from "./types";
