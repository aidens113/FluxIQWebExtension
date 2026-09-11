// The wire types the content script uses: the JSON envelope, the DOM
// descriptors it captures, the recording events it sends, and the
// browser-action command and result it exchanges with the background worker.
// They are the shared protocol's own types, re-exported so content modules keep
// one local import. Change a shape in `shared/protocol.ts`, which the background
// worker compiles against too. The exports are type-only, so the protocol's
// runtime imports never reach the content bundle.

export type {
  BrowserActionCommand,
  BrowserActionResult,
  DomElementDescriptor,
  DomSnapshot,
  JsonObject,
  JsonValue,
  RecordingEventKind,
  RecordingEventPayload,
  RectDescriptor
} from "../shared/protocol";
