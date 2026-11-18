// The AI key's state as the background pushes it: each `fluxiq.panel.modelAccessChanged` broadcast carries
// Core's model-access state, drawn at once with no read and no timer. A message that is not that broadcast is
// ignored; a broadcast whose state cannot be read says "changed, read again" (`null`), never a guess.
// The type is the background's (`PANEL_MODEL_ACCESS_CHANGED` in shared/protocol.ts once key-backend merges).

import { readModelAccessState } from "@fluxiq/contracts/platform";
import { modelAccessFromCore, type ModelAccessState } from "@fluxiq/ui-components";
import { asRecord } from "../../reply";
import type { RuntimeListen } from "../activity";

/** The broadcast's message type, matching the background's exactly. */
export const MODEL_ACCESS_CHANGED_MESSAGE = "fluxiq.panel.modelAccessChanged";

/** Tells `listener` the key's state on each broadcast heard through `listen`; returns the unsubscribe. */
export function subscribeModelAccess(listen: RuntimeListen, listener: (state: ModelAccessState | null) => void): () => void {
  return listen((message) => {
    const pushed = asRecord(message);
    if (pushed?.type !== MODEL_ACCESS_CHANGED_MESSAGE) return;
    const access = readModelAccessState(pushed.modelAccess);
    listener(access ? modelAccessFromCore(access) : null);
  });
}
