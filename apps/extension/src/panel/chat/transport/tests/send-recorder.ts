// Test support: a fake `request` that records each message and answers every one with the same reply.

import type { PanelMessage, PanelResult, PanelStore } from "../../../state";

export type SendRecorder = {
  sent: PanelMessage[];
  request: PanelStore["request"];
};

/** Answers every message with `reply`, keeping the messages in `sent`. */
export function sendRecorder(reply: PanelResult<unknown>): SendRecorder {
  const sent: PanelMessage[] = [];
  const request = (async (message: PanelMessage) => {
    sent.push(message);
    return reply;
  }) as PanelStore["request"];
  return { sent, request };
}
