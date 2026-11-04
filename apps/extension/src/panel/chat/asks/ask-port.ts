// The chat's ask port for the extension: Core's question in the extension's words
// (`present-ask.ts`) and, when one is given, the dialog that takes a PIN.
//
// The panel mounts this with no dialog today, because a PIN cannot do its job from
// a paired browser: Core skips the check for a paired client and nothing here runs
// what the confirmation carries (`chat-panel.ts`). With none, the chat shows
// "Answer this in FluxIQ." and the Open FluxIQ control instead of Confirm.

import type { ChatAskPort, ChatReauthorizeRequest } from "@fluxiq/ui-components";
import { presentAsk } from "./present-ask";

/** How the port is made. `surface` defaults to the one the panel mounted on. */
export type AskPortOptions = {
  working(): boolean;
  surface?(): string | undefined;
  /** Draws the PIN dialog (`showPinDialog`). Absent: a question that needs one goes to FluxIQ. */
  pinDialog?(request: ChatReauthorizeRequest): void;
};

/** Creates the port. */
export function createAskPort(options: AskPortOptions): ChatAskPort {
  const surface = options.surface ?? mountedSurface;
  const pinDialog = options.pinDialog;
  const present: ChatAskPort["present"] = (ask) => presentAsk(ask, { surface, working: options.working, pinDialog: pinDialog !== undefined });
  if (pinDialog === undefined) return { present };
  return {
    present,
    reauthorize(request) {
      // The press was made for a question drawn before work began: nothing asks in the middle of a task.
      if (options.working()) request.cancel();
      else pinDialog(request);
    }
  };
}

function mountedSurface(): string | undefined {
  return (globalThis as { document?: { documentElement?: { dataset?: Record<string, string | undefined> } } }).document?.documentElement?.dataset?.surface;
}
