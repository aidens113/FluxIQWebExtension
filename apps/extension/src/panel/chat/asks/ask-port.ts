// The chat's ask port for the extension: Core's question in the extension's words
// (`present-ask.ts`).
//
// There is no PIN dialog: one press of Allow answers a permission, and the
// panel never asks for a PIN. A confirmation that does need one (a shared-thread
// `panel-command.` question naming a lasting act) shows "Answer this in FluxIQ."
// and the Open FluxIQ control instead of Confirm, because the answer is FluxIQ's.

import type { ChatAskPort } from "@fluxiq/ui-components";
import { presentAsk } from "./present-ask";

/** How the port is made. `surface` defaults to the one the panel mounted on. */
export type AskPortOptions = {
  working(): boolean;
  surface?(): string | undefined;
};

/** Creates the port. */
export function createAskPort(options: AskPortOptions): ChatAskPort {
  const surface = options.surface ?? mountedSurface;
  return { present: (ask) => presentAsk(ask, { surface, working: options.working }) };
}

function mountedSurface(): string | undefined {
  return (globalThis as { document?: { documentElement?: { dataset?: Record<string, string | undefined> } } }).document?.documentElement?.dataset?.surface;
}
