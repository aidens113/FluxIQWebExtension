// A panel store for settings tests: one status, delivered to every subscriber at once, and a request that answers
// with an empty success unless a test supplies its own.

import type { ExtensionStatus } from "../../../shared/protocol";
import type { PanelResult, PanelStore } from "../../state";

/** The store; `request` defaults to an empty success. */
export function storeWith(current: ExtensionStatus, request: PanelStore["request"] = async <T>(): Promise<PanelResult<T>> => ({ ok: true, value: {} as T })): PanelStore {
  return {
    current: () => current,
    subscribe(listener) {
      listener(current);
      return () => undefined;
    },
    request
  };
}

/** A request that records each message it is sent and answers an empty success. */
export function recordingRequest(sent: Array<Record<string, unknown>>): PanelStore["request"] {
  return async <T>(message: Record<string, unknown>): Promise<PanelResult<T>> => {
    sent.push(message);
    return { ok: true, value: {} as T };
  };
}
