// The extension's model-keys port for the shared key card: it reads the key's state through the background
// and writes the person's own key through it (`send-key-write.ts`), with no password. `read` is how the state
// is read; a screen that already has the one reader (Settings, through the setup port) passes it, so there is
// only one. A write's answer carries the checked state; the card reads it again after the write.

import type { ModelAccessState, ModelKeysPort, ModelKeysResult } from "@fluxiq/ui-components";
import type { PanelStore } from "../../../../state";
import { readModelAccess } from "./read-model-access";
import { KEY_WRITE_MESSAGES, sendKeyWrite } from "./send-key-write";

/** Builds the port over `request`; `read` replaces the default reading. */
export function modelKeysPort(request: PanelStore["request"], read: () => Promise<ModelKeysResult<{ state: ModelAccessState }>> = () => readModelAccess(request)): ModelKeysPort {
  return {
    readState: read,
    save: async ({ provider, name, value }) => sendKeyWrite(request, { type: KEY_WRITE_MESSAGES.save, provider, key: value, ...(name ? { name } : {}) }),
    replace: async (_keyId, value) => sendKeyWrite(request, { type: KEY_WRITE_MESSAGES.replace, key: value }),
    remove: async () => sendKeyWrite(request, { type: KEY_WRITE_MESSAGES.remove }),
    requiresPassword: false,
    canWrite: true
  };
}
