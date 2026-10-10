// The browser's answer to Core asking what became of one command (plan B3,
// Core C8, `server.reconcile_command`). It is decided from what the browser
// kept -- never by acting -- in this order:
//
//  - **running**: the command is being carried out here now;
//  - **landed**: a result is kept for it (just sent, or waiting in the offline
//    queue), and that result goes back with the answer. A result the browser
//    reported as interrupted is still the result it has; Core reads it as any
//    interrupted result;
//  - **unknown**: the browser had it -- a record an earlier worker left without
//    a result, or an id it remembers receiving whose result it no longer
//    holds -- and cannot say what became of it. Core does not act again;
//  - **not_seen**: nothing at all: the command never reached this browser, so
//    making it again is not a second act. The browser refuses that id from
//    then on.

import type { ClientGatewayActionResult, ClientGatewayClientMessage } from "@fluxiq/client-gateway-websocket";

/** The `client.reconcile_result` payload. */
export type WebAutomationReconcileAnswer = Extract<ClientGatewayClientMessage, { type: "client.reconcile_result" }>["payload"];

/** What the browser knows about one command id. */
export type WebAutomationCommandKnowledge = {
  running: boolean;
  result?: ClientGatewayActionResult | undefined;
  recordLeft: boolean;
  seen: boolean;
};

export function webAutomationReconcileAnswer(commandId: string, known: WebAutomationCommandKnowledge): WebAutomationReconcileAnswer {
  if (known.running) return { commandId, state: "running" };
  if (known.result !== undefined) return { commandId, state: "landed", result: known.result };
  if (known.recordLeft || known.seen) return { commandId, state: "unknown" };
  return { commandId, state: "not_seen" };
}
