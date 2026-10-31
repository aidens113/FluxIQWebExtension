import type { WebNodeFrozenCommand, WebNodeFrozenResult } from "../types";
import { webNodeDispatchObservers } from "./observers";

/** Register a main attempt across the gateway's last deterministic lowering. */
export async function webNodeObservedDispatch(
  command: WebNodeFrozenCommand,
  observed: (sessionId: string, command: WebNodeFrozenCommand) => void,
  execute: () => Promise<WebNodeFrozenResult>
): Promise<WebNodeFrozenResult> {
  webNodeDispatchObservers.set(command, observed);
  try { return await execute(); }
  finally { webNodeDispatchObservers.delete(command); }
}
