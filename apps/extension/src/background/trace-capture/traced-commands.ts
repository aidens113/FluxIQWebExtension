// The command ids Core asked this worker to trace, noted from the raw server
// message and taken once, when the command's result is about to go out.
//
// The request rides in the command's `metadata`, which the gateway session's
// action mapping drops (it keeps only the fields an action has). The socket
// hands every server message to the channel's `handleMessage` before it
// dispatches the typed `execute_action` (`transport.ts` in
// `@fluxiq/client-gateway-websocket` emits `message` first), so the id is
// noted here before the command can start, and the action itself carries
// nothing new.
//
// Bounded: an id whose result never comes (a worker that stopped, a command
// refused before it ran) is forgotten once newer ones push it out.

import type { ClientGatewayServerMessage } from "../../shared/protocol";
import { isTraceRequest } from "./is-trace-request";

/** How many traced ids are kept waiting for their result at once. */
const TRACED_COMMAND_LIMIT = 256;

export class TracedCommands {
  private readonly ids = new Set<string>();

  /** Notes the command a server message carries when Core asked for it to be traced. */
  note(message: ClientGatewayServerMessage): void {
    if (message.type !== "server.execute_action") return;
    const { commandId, metadata } = message.payload;
    if (typeof commandId !== "string" || !isTraceRequest(metadata)) return;
    this.ids.delete(commandId);
    this.ids.add(commandId);
    while (this.ids.size > TRACED_COMMAND_LIMIT) {
      const oldest = this.ids.values().next().value as string;
      this.ids.delete(oldest);
    }
  }

  /** Whether the command was asked to be traced; true at most once per noting. */
  take(commandId: string): boolean {
    return this.ids.delete(commandId);
  }
}
