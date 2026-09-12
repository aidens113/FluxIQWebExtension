// Everything the state projection knows about an individual element: what it
// is (`kind`), what it is called (`identity`), and whether it earns a place in
// the snapshot (`selection`). Read from outside this directory through here.

export { elementStateId, elementStateIdAssigner, meaningfulText, stableAttribute, stableElementId } from "./identity";
export { isEnabled, isLikelyActionableElement, isLikelyInteractableElement, isPrimaryControlElement, isSemanticTextElement } from "./kind";
export { filterStateElements, MAX_STATE_ELEMENTS, shouldCaptureElementState, WEB_AUTOMATION_ELEMENT_SUMMARY_STATE_IDS } from "./selection";
export type { WebAutomationStateElement, WebAutomationStateElementSelection } from "./selection";
