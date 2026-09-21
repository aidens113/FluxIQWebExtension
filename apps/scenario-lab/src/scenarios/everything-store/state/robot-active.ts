import type { StoreState } from "./types.js";

/** Whether the store answers every page with its robot check: armed so, or flagged, and not yet passed by a person. */
export function robotCheckActive(state: StoreState): boolean {
  return (state.mode === "robot-check" || state.guard.flagged !== null) && !state.guard.robot.solved;
}
