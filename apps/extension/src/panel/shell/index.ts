// The shell: the top bar, the one PanelStore, and which screen fills the panel.
export type { PanelContext, PanelSurface } from "./contracts";
export { mountPanel } from "./mount-panel";
export { INITIAL_SHELL, reduceShell, shellScreen, type ShellEvent, type ShellScreen, type ShellState, type ShellTab } from "./screen-state";
export { createTopBar, screenId, tabId, type TopBar, type TopBarParts } from "./top-bar";
