// The shell: the top bar, the one PanelStore, which screen fills the panel,
// and the held "FluxIQ is working" the record, extract and Run controls wait on.
export type { PanelContext, PanelSurface } from "./contracts";
export { mountPanel } from "./mount-panel";
export { INITIAL_SHELL, reduceShell, shellScreen, type ShellEvent, type ShellScreen, type ShellState, type ShellTab } from "./screen-state";
export { createTopBar, screenId, tabId, type TopBar, type TopBarParts } from "./top-bar";
export { createWorkingHold, WORKING_OFF_MS, WORKING_ON_MS, type WorkingClock, type WorkingHold } from "./working-hold";
export { workingInput } from "./working-input";
