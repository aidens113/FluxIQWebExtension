import type { CreatedFlowLanePermissionStop } from "../flow-lane/index.js";

/**
 * A created-Flow build that stopped to ask the person at the task's declared
 * permission point: the consequence it asked permission for, and whether the
 * control it stopped at is the one the task declares (`matched`) or went
 * unnamed. Its run's verdict is `stopped_for_permission`, never `passed`
 * (`built-flow.ts`).
 */
export type FlowLanePermissionStop = Pick<CreatedFlowLanePermissionStop["permissionStop"], "consequence" | "control">;

/** A permission stop as a run reports it: its own verdict, never `passed`, with where it stopped. */
export type FlowLaneStoppedForPermission = Readonly<{ verdict: "stopped_for_permission" }> & FlowLanePermissionStop;
