import type { ScriptedModelScript } from "../script.js";

/** Permission protocol only: no decision reply exists, so this fixture cannot execute the task's deletion. */
export function socialNetworkDeleteStrangerRequestsScript(form?: string): ScriptedModelScript {
  if (form !== "preflight-permission") throw new Error("This social task fixture proves only preflight-permission; it is not a full task script");
  return {
    taskId: "social-network-feed-delete-stranger-requests",
    replies: { panel_command: [(request) => ({ do: "flow.createHere", with: { instruction: request.message }, acts: ["delete"], process: null })] },
  };
}
