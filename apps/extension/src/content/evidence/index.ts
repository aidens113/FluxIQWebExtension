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
// Two modules here answer about one element rather than about the page, and
// neither answer is carried as a field.
//
// `controls.ts` says which of the page's controls change what the page shows,
// which the page drew by hand out of elements the browser makes nothing of, and
// which are the site's standing footer; the snapshot's ranking reads it to
// decide what the bounded element list describes first -- the difference
// between a model being shown a filter rail and being shown twenty footer
// links, and between being shown a marketplace's filters and not being shown
// them at all because they are `<div>`s.
//
// `link-address.ts` says when a link's address would only repeat the page the
// link is on. The descriptor reads it to decide not to publish an address the
// packet already carries as its `location`, which was 22% of the budget on one
// of the campaign's sites before it did.

export { markElementActivity, forgetElementActivity, type SnapshotElementEntry } from "./changes";
export { isDrawnControl, isFrontLayer, isPageStateControl, isSiteChrome } from "./controls";
export { dialogEvidence } from "./dialogs";
export { formEvidence } from "./forms";
export { forgetInteractedElements, recentlyInteractedElements, rememberInteractedElement } from "./interactions";
export { repeatsTheDocumentAddress } from "./link-address";
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
