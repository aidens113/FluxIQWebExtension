// The wire types the content script uses: the JSON envelope, the DOM
// descriptors it captures, the recording events it sends, and the
// browser-action command and result it exchanges with the background worker.
// They are the shared protocol's own types, re-exported so content modules keep
// one local import. Change a shape in `shared/protocol.ts`, which the background
// worker compiles against too, and which takes the command and result from
// `domain/src/actions/types.ts` so there is one definition, not three. The
// exports are type-only, so the protocol's runtime imports never reach the
// content bundle.
//
// The two shapes Phase 1.4 widened -- the descriptor's `changed` and
// `recentlyInteracted` activity flags, and the snapshot's page-level
// `evidence` -- were briefly redeclared here as intersections of the protocol's
// own. They are wire-visible and the background worker compiles against them
// too, so they are declared once in `shared/protocol.ts` beside the shapes they
// widen, and re-exported here like everything else.

export type {
  BrowserActionCommand,
  BrowserActionResult,
  BrowserActionStatus,
  BrowserActionTargetResolution,
  BrowserActionTargetStrategy,
  BrowserActionValidation,
  BrowserActionValidationSkipReason,
  DomElementContext,
  DomElementDescriptor,
  DomSnapshot,
  JsonObject,
  JsonValue,
  RecordingEventKind,
  RecordingEventPayload,
  RectDescriptor,
  WebAutomationAssertKind,
  WebAutomationAssertRequest,
  WebAutomationDialogRequest,
  WebAutomationDownloadRequest,
  WebAutomationExtractListPagination,
  WebAutomationExtractListRequest,
  WebAutomationKeyModifiers,
  WebAutomationOptionSelector,
  WebAutomationScrollRequest,
  WebAutomationTabRequest,
  WebAutomationUploadFile,
  WebAutomationUploadRequest,
  WebAutomationWaitCondition,
  WebAutomationWaitRequest
} from "../shared/protocol";
