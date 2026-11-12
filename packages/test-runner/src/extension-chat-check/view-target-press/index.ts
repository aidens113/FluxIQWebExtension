// Real mouse input into an extension view Playwright gives no Page for
// (Chrome's real side panel): the chat's answers require a person's activation.
export { attachTarget, type TargetChannel } from "./attach-target.js";
export { inPanelTarget, type PanelTargetAnswer, type PanelTargetStep, type PressSeen } from "./in-panel-target.js";
export { pressInViewTarget } from "./press-in-view-target.js";
