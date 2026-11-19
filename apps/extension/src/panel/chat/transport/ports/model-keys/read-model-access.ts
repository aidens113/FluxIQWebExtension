// The one reading of the person's AI key: the background's readiness reply, as the card's state. The reply
// carries Core's model-access state (`payload.modelAccess`, without the key's id) or, from a FluxIQ older than
// that contract, nothing: an absent or unreadable state reads as "Update FluxIQ". A failed read is a failure
// the card words itself, never a state. Nothing here sees a key's value.

import { readModelAccessState } from "@fluxiq/contracts/platform";
import { modelAccessFromCore, type ModelAccessState, type ModelKeysResult } from "@fluxiq/ui-components";
import { RUNTIME_MESSAGES } from "../../../../../shared/constants";
import type { PanelStore } from "../../../../state";
import { payloadOf } from "../../reply";

/** What the card says when the state could not be read at all. */
export const COULD_NOT_CHECK_KEY = "Couldn't check your AI key just now.";

/** Asks the background for the AI key's state; never throws. */
export async function readModelAccess(request: PanelStore["request"]): Promise<ModelKeysResult<{ state: ModelAccessState }>> {
  try {
    const payload = payloadOf(await request({ type: RUNTIME_MESSAGES.panelModelReadiness }));
    if (!payload.ok) return { ok: false, message: COULD_NOT_CHECK_KEY };
    return { ok: true, state: modelAccessFromCore(readModelAccessState(payload.value.modelAccess)) };
  } catch {
    return { ok: false, message: COULD_NOT_CHECK_KEY };
  }
}
