// The panel UI both surfaces mount: the popup and the side panel each call
// `mountPanel(root, surface)`. See panel/shell/mount-panel.ts for the module map.
export { connectionCopy, errorSentence, stepSentence } from "./copy";
export { mountPanel, type PanelContext, type PanelSurface } from "./shell";
export { createPanelStore, panelRequest, type PanelResult, type PanelStore } from "./state";
