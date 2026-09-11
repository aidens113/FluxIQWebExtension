import { identityDriftModes, type IdentityDriftMode } from "./modes.js";

/** Longest workspace name a save accepts; a longer one leaves the state unchanged. */
const MAX_DISPLAY_NAME_LENGTH = 80;

/**
 * Fixture state, served by `/__control/final-state` as the run oracle.
 * `savedInMode` names the rendering a save went through, and `status` is the
 * text the page's status line shows.
 */
export type IdentityDriftState = {
  mode: IdentityDriftMode;
  defaultDisplayName: string;
  savedDisplayName: string | null;
  saveCount: number;
  savedInMode: IdentityDriftMode | null;
  discardCount: number;
  lastOperation: "seeded" | "saved" | "discarded" | "armed";
  status: string;
};

export function createIdentityDriftState(seed: number): IdentityDriftState {
  return {
    mode: "baseline",
    defaultDisplayName: `Workspace ${seed}`,
    savedDisplayName: null,
    saveCount: 0,
    savedInMode: null,
    discardCount: 0,
    lastOperation: "seeded",
    status: "",
  };
}

/**
 * `save` ({ displayName }) records a save through the current rendering;
 * `discard` records the Discard control; `set-mode` ({ mode }) switches the
 * rendering and clears the save record, so once a variant is armed only a save
 * through the drifted action counts. Anything else leaves the state unchanged.
 */
export function mutateIdentityDriftState(state: IdentityDriftState, operation: string, payload: unknown): IdentityDriftState {
  if (operation === "save") {
    const displayName = isRecord(payload) && typeof payload.displayName === "string" ? payload.displayName.trim() : "";
    if (displayName.length === 0 || displayName.length > MAX_DISPLAY_NAME_LENGTH) return state;
    return { ...state, savedDisplayName: displayName, saveCount: state.saveCount + 1, savedInMode: state.mode, lastOperation: "saved", status: `Saved: ${displayName}` };
  }
  if (operation === "discard") {
    return { ...state, discardCount: state.discardCount + 1, lastOperation: "discarded", status: "Changes discarded" };
  }
  if (operation === "set-mode" && isRecord(payload) && isMode(payload.mode)) {
    return { ...state, mode: payload.mode, savedDisplayName: null, saveCount: 0, savedInMode: null, discardCount: 0, lastOperation: "armed", status: "" };
  }
  return state;
}

function isMode(value: unknown): value is IdentityDriftMode {
  return typeof value === "string" && (identityDriftModes as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
