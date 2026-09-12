// The extension's names for the page-evidence wire contract. Nothing is
// declared here.
//
// What the snapshot says about the page as a whole, rather than about one
// element -- the dialogs standing in front of it, what is covering its
// controls, whether it is still working, how it is laid out, what repeats on
// it, the forms it holds, and how it was navigated to -- used to be declared
// here and restated, from memory, in two domain modules. The structure audit
// forbids `domain/src` importing `apps/extension/src`, so no compiler could
// join the three, and they came apart three times in one plan: a truncation
// flag no producer wrote, five page items read at paths no producer wrote, and
// a state-path ratchet that passed over an empty set.
//
// The dependency rule decides which way the join can go. The domain may not
// import the extension; the extension may import the domain. So the contract
// lives in `domain/src/page-evidence/`, and this file is the extension's one
// import of it -- every producer module, `shared/protocol.ts` and the
// background worker's frame merge go through the names below.
//
// The names are shorter here because a content module reads better saying
// `DialogEvidence` than `WebAutomationDialogEvidence`, and because eight
// modules and two test suites already spell them this way. They are aliases,
// not copies: each is the same type object as the domain's, so the two
// spellings cannot come to mean different things -- rename a field on either
// side and both sides stop compiling. Add a field here and it must be added to
// the contract, which is the outcome this file exists to force.
//
// `apps/extension/src/content/evidence/` is still where the evidence is
// *produced*; only the shape is shared. And `RectDescriptor` in
// `shared/protocol.ts` stays the extension's rect for element geometry: it is
// structurally identical to the contract's `WebAutomationEvidenceRect`, which
// is what lets a descriptor's bounds and a dialog's bounds be compared.

export type {
  WebAutomationDialogEvidence as DialogEvidence,
  WebAutomationDialogEvidenceItem as DialogEvidenceItem,
  WebAutomationEvidenceRect as EvidenceRect,
  WebAutomationFormControlEvidence as FormControlEvidence,
  WebAutomationFormEvidence as FormEvidence,
  WebAutomationLoadingEvidence as LoadingEvidence,
  WebAutomationLoadingIndicator as LoadingIndicator,
  WebAutomationLoadingIndicatorKind as LoadingIndicatorKind,
  WebAutomationNativeDialogEvidence as NativeDialogEvidence,
  WebAutomationNavigationEvidence as NavigationEvidence,
  WebAutomationOverlayEvidence as OverlayEvidence,
  WebAutomationOverlayEvidenceItem as OverlayEvidenceItem,
  WebAutomationPageEvidence as PageEvidence,
  WebAutomationRegionEvidence as RegionEvidence,
  WebAutomationRepeatingStructureEvidence as RepeatingStructureEvidence,
  WebAutomationSnapshotElementTotals as SnapshotElementTotals
} from "@fluxiq-web-extension/domain";
