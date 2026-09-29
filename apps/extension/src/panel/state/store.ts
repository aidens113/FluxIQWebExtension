// The panel's one source of status.
//
// On creation the store asks the background once for its status and listens
// for every `statusChanged` push after that. A request whose reply carries a
// status (every connection and recording command answers with one) publishes
// that status too, so a view that sends Start recording sees the result without
// asking again.
//
// Failures never touch the status. They come back to the view that made the
// request, as a sentence, and that view keeps showing it: a status render does
// not wipe it (audit defect F1, where a refused command flashed and vanished
// because the status re-render hid the error line in the same tick).

import { RUNTIME_MESSAGES } from "../../shared/constants";
import type { ExtensionStatus } from "../../shared/protocol";
import { panelRequest, type PanelMessage } from "./request";
import type { PanelResult } from "./result";

/** The panel's status, its changes, and its one way to send a message (pinned by the UI audit, section 5). */
export type PanelStore = {
  current(): ExtensionStatus | undefined;
  /** Calls `listener` with every status from now on, and at once when one is already known. Returns an unsubscribe. */
  subscribe(listener: (status: ExtensionStatus) => void): () => void;
  /** Sends `message`; never throws. A reply carrying a status also publishes it. */
  request<T>(message: PanelMessage): Promise<PanelResult<T>>;
};

/** Creates the store, asks for the current status, and starts listening for pushes. */
export function createPanelStore(): PanelStore {
  let status: ExtensionStatus | undefined;
  const listeners = new Set<(status: ExtensionStatus) => void>();

  function publish(next: ExtensionStatus): void {
    status = next;
    for (const listener of [...listeners]) listener(next);
  }

  chrome.runtime.onMessage.addListener((message: unknown) => {
    const typed = message as { type?: unknown; status?: unknown };
    if (typed?.type === RUNTIME_MESSAGES.statusChanged && isStatus(typed.status)) publish(typed.status);
  });

  const store: PanelStore = {
    current: () => status,
    subscribe(listener) {
      listeners.add(listener);
      if (status !== undefined) listener(status);
      return () => {
        listeners.delete(listener);
      };
    },
    async request<T>(message: PanelMessage): Promise<PanelResult<T>> {
      const result = await panelRequest<T>(message);
      if (result.ok) {
        const carried = (result.value as { status?: unknown } | undefined)?.status;
        if (isStatus(carried)) publish(carried);
      }
      return result;
    }
  };

  void store.request({ type: RUNTIME_MESSAGES.getStatus });
  return store;
}

function isStatus(value: unknown): value is ExtensionStatus {
  return typeof value === "object" && value !== null && typeof (value as { connectionState?: unknown }).connectionState === "string";
}
