// The web state projection: a browser DOM snapshot, or a set of tabs, turned
// into a Core `StateSnapshot` in the `web` namespace.
//
// The pipeline reads in one direction. `element/` decides which elements are
// worth carrying and what each is called; `state-values.ts` writes them into
// the namespace; `visual-frame.ts` draws them; `snapshot.ts` and
// `tab-state.ts` are the two entry points. `action-target.ts` is the sideways
// path: one element described for an action rather than for state.
//
// Only the names below are public. `putStateValue`, the geometry conversions
// and `compactJsonObject` are internal to the projection: exporting them would
// invite a second way to write a state value, and the namespace header,
// default confidence and undefined-stripping only hold because there is one.

export { webAutomationActionTargetFromElement, webAutomationActionVisualTargetFromElement } from "./action-target";
export {
  filterStateElements,
  MAX_STATE_ELEMENTS,
  shouldCaptureElementState,
  WEB_AUTOMATION_ELEMENT_SUMMARY_STATE_IDS
} from "./element";
export type { WebAutomationStateElement, WebAutomationStateElementSelection } from "./element";
export { createWebAutomationStateFromSnapshot } from "./snapshot";
export { createWebAutomationStateFromTabs } from "./tab-state";
export type {
  WebAutomationDomSnapshotInput,
  WebAutomationElementStateInput,
  WebAutomationRect,
  WebAutomationScreenImageSize,
  WebAutomationTabStateInput
} from "./types";
export {
  MAX_VISUAL_FRAME_ELEMENTS,
  WEB_AUTOMATION_DOCUMENT_FRAME_ID,
  WEB_AUTOMATION_SCREEN_FRAME_ID,
  WEB_AUTOMATION_VIEWPORT_VISUALIZER_ID
} from "./visual-frame";
