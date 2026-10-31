import type { WebNodeFrozenCommand } from "../types";
import { webNodeDispatchObservers } from "./observers";

/** Called only by the owning gateway after check-wait lowering, before send. */
export function webNodeFinalDispatch(sessionId: string, original: WebNodeFrozenCommand, actual: WebNodeFrozenCommand): void {
  webNodeDispatchObservers.get(original)?.(sessionId, actual);
}
