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

export { markElementActivity, forgetElementActivity, type SnapshotElementEntry } from "./changes";
export { dialogEvidence } from "./dialogs";
export { formEvidence } from "./forms";
export { forgetInteractedElements, recentlyInteractedElements, rememberInteractedElement } from "./interactions";
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
