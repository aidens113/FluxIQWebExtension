// The extension's in-flight command reconciliation (plan B3, Core C8): Core's
// `ClientGatewayCommandReconciliation` -- the record written before a command
// goes to a page, the report of one an earlier worker lost, the answer to a
// repeated id and to Core asking what became of one -- with this domain's
// facts handed in:
//
//  - which acts commit (`webAutomationActionCommits`): a lost committing act
//    is reported `unknown`, any other an `unacted` failure
//    (`webAutomationInterruptedActionResult`);
//  - what a late copy of a command answered `not_seen` is refused with
//    (`webAutomationNotSeenActionResult`).
//
// The records and the ids received live in a session-long storage area
// (`./record-area.ts`), under Core's default keys -- `fluxiq.inFlight.` and
// `fluxiq.commandSeen.`, the ones earlier builds wrote -- so a worker started
// by an upgrade still finds what the one before it kept. A record's place is
// the tab and document the command went to (`./frame-document.ts`); it never
// holds a value the command carried or a page address.

import {
  ClientGatewayCommandReconciliation,
  ClientGatewayInFlightRecordStore,
  ClientGatewaySeenCommandStore,
  type ClientGatewayCommandReconciliationDeps,
  type ClientGatewayStorageArea
} from "@fluxiq/client-gateway-websocket";
import {
  webAutomationActionCommits,
  webAutomationInterruptedActionResult,
  webAutomationNotSeenActionResult
} from "@fluxiq-web-extension/domain/client";

/**
 * A reconciliation over `area`. `queuedResult` reads the offline queue
 * (`GatewaySession.queuedActionResult`); `send` sends a result as
 * `client.action_result`, or queues it while the socket is down.
 */
export function webCommandReconciliation(
  deps: Pick<ClientGatewayCommandReconciliationDeps, "queuedResult" | "send" | "now"> & { readonly area: ClientGatewayStorageArea }
): ClientGatewayCommandReconciliation {
  return new ClientGatewayCommandReconciliation({
    store: new ClientGatewayInFlightRecordStore(deps.area),
    seen: new ClientGatewaySeenCommandStore(deps.area),
    queuedResult: deps.queuedResult,
    send: deps.send,
    commits: (actionType, parameters) => webAutomationActionCommits(actionType, parameters),
    interruptedResult: (record, completedAt) => webAutomationInterruptedActionResult(record, completedAt),
    notSeenResult: (commandId, at) => webAutomationNotSeenActionResult(commandId, at),
    ...(deps.now === undefined ? {} : { now: deps.now })
  });
}
