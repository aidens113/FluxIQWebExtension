// The extension's model-keys port for the shared key card: it only shows the key's state, read through the
// background. Keys are added and changed in the FluxIQ panel, never in a client, so `canWrite` is false and the
// card draws the state with one action that sends the person to the panel. `read` is how the state is read; a
// screen that already has the one reader (Settings, through the setup port) passes it, so there is only one.
// The three write methods exist only because the port's type has them: each refuses in the panel's words.

import type { ModelAccessState, ModelKeysPort, ModelKeysResult } from "@fluxiq/ui-components";
import type { PanelStore } from "../../../../state";
import { readModelAccess } from "./read-model-access";

/** What a write says if anything calls one anyway. */
const IN_THE_PANEL = "Add or change your AI key in the FluxIQ panel.";

/** Builds the port over `request`; `read` replaces the default reading; `subscribe` (the background's pushed key state) lets the card follow the key as it is pushed. */
export function modelKeysPort(request: PanelStore["request"], read: () => Promise<ModelKeysResult<{ state: ModelAccessState }>> = () => readModelAccess(request), subscribe?: ModelKeysPort["subscribe"]): ModelKeysPort {
  const refuse = async (): Promise<ModelKeysResult<never>> => ({ ok: false, message: IN_THE_PANEL });
  return {
    readState: read,
    ...(subscribe === undefined ? {} : { subscribe }),
    save: refuse,
    replace: refuse,
    remove: refuse,
    canWrite: false
  };
}
