// The page-evidence wire contract, and the one place it is declared.
//
// A browser capture carries two kinds of thing: elements, and facts about the
// page as a whole -- the dialogs standing in front of it, what is painted over
// its controls, whether it is still working, how it is laid out, what repeats
// on it, its forms, and how it was navigated to. The second kind is produced in
// `apps/extension/src/content/evidence/` and read twice in this package, by
// `recording/web-state/evidence/` for Core state and by `runtime/llm-evidence/`
// for the packet a model sees.
//
// Three producers and consumers, and until this directory existed, three
// separate declarations of the shape they exchange -- because the structure
// audit forbids `domain/src` importing `apps/extension/src`, so the compiler
// could not join them. They came apart three times in one plan, each time
// silently and each time with both sides' own tests green. `types.ts` says why,
// in detail.
//
// The direction is forced: the extension may import the domain and the domain
// may not import the extension, so the contract lives here and the extension
// imports it (`apps/extension/src/content/evidence/types.ts` re-exports these
// names under the extension's shorter local spellings and adds nothing).
//
// Types only. No behaviour, no caps, no defaults -- a reader's bounds belong to
// that reader, and a producer's to the producer. The two exceptions are
// deliberate and neither decides anything: `wire.ts` is how an untrusted
// capture is read with the contract's own keys, and `capture.ts` is real
// captures, so both sides can be joined by data as well as by a type.
//
// It sits at the top of `domain/src/` rather than under `recording/` or
// `runtime/` because both read it, and putting it under either would make one
// of them depend on the other. `sensitivity/` is here for the same reason.

export { WEB_AUTOMATION_PAGE_EVIDENCE_CAPTURES, type WebAutomationPageEvidenceCaptureName } from "./capture";
export { pageEvidenceWire, type PageEvidenceWire } from "./wire";
export type {
  WebAutomationDialogEvidence,
  WebAutomationDialogEvidenceItem,
  WebAutomationDocumentReadyState,
  WebAutomationDocumentVisibility,
  WebAutomationEvidenceRect,
  WebAutomationFormControlEvidence,
  WebAutomationFormEvidence,
  WebAutomationLoadingEvidence,
  WebAutomationLoadingIndicator,
  WebAutomationLoadingIndicatorKind,
  WebAutomationNativeDialogEvidence,
  WebAutomationNavigationEvidence,
  WebAutomationOverlayEvidence,
  WebAutomationOverlayEvidenceItem,
  WebAutomationPageEvidence,
  WebAutomationRegionEvidence,
  WebAutomationRepeatingStructureEvidence,
  WebAutomationSnapshotElementTotals
} from "./types";
