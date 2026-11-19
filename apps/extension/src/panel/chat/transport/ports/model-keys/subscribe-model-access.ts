// The AI key's state as the background pushes it: each `fluxiq.panel.modelAccessChanged` broadcast carries
// Core's model-access state, drawn at once with no read and no timer. A message that is not that broadcast is
// ignored; a broadcast whose state cannot be read says "changed, read again" (`null`), never a guess.
// The type is the background's own (`PANEL_MODEL_ACCESS_CHANGED`, shared/model-key-messages.ts).

import { readModelAccessState } from "@fluxiq/contracts/platform";
import { modelAccessFromCore, type ModelAccessState } from "@fluxiq/ui-components";
import { PANEL_MODEL_ACCESS_CHANGED } from "../../../../../shared/model-key-messages";
import { asRecord } from "../../reply";
import type { RuntimeListen } from "../activity";

/** Tells `listener` the key's state on each broadcast heard through `listen`; returns the unsubscribe. */
export function subscribeModelAccess(listen: RuntimeListen, listener: (state: ModelAccessState | null) => void): () => void {
  return listen((message) => {
    const pushed = asRecord(message);
    if (pushed?.type !== PANEL_MODEL_ACCESS_CHANGED) return;
    const access = readModelAccessState(pushed.modelAccess);
    listener(access ? modelAccessFromCore(access) : null);
  });
}
