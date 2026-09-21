import type { BigboxState } from "../types.js";

/** The results document that trips the bot check: the third one served since a reset, whichever search it is. */
export const ROBOT_CHECK_AT_LOAD = 3;

/** How long the check page waits before it looks again on its own, and how long a press must be held. */
export const ROBOT_CHECK_WAIT_MS = 8_000;
export const ROBOT_CHECK_HOLD_MS = 2_000;

/** Whether the next results document served is the one that raises the check. */
export function challengesNextLoad(state: Pick<BigboxState, "robot">): boolean {
  return state.robot.status === "idle" && state.robot.searchLoads + 1 === ROBOT_CHECK_AT_LOAD;
}
