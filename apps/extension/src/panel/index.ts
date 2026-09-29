// The panel UI both surfaces mount: the popup and the side panel each call
// `mountPanel(root, surface, views)`. See panel/shell/mount-panel.ts for the
// module map, and the UI audit, section 5, for who owns which directory.
export { createPanelStore, panelRequest, type PanelResult, type PanelStore } from "./state";
export { connectionCopy, errorSentence, stepSentence } from "./copy";
export {
  mountPanel,
  placeholderViews,
  type AdvancedTab,
  type PanelRoute,
  type PanelSurface,
  type PanelView,
  type PanelViewContext,
  type PanelViews
} from "./shell";
