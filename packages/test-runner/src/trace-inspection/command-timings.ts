// Command round trips as a trace shows them: each outbound message with a
// command id, to the first inbound message answering that id, on Core's own
// observed clock (`time.logicalMs`). Grouped by the outbound message type and,
// for `server.execute_action`, its `actionType` -- protocol vocabulary, never
// page text: a value that is not a plain identifier is reported as "other".

import type { ClientGatewayTraceEvent } from "fluxiq/client-gateway";
import { tracePayloadValue } from "./payload-value.js";
import type { TraceCommandTimings } from "./types.js";

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/u;

/** Per command group: how many were sent, and the summed and longest time to their answer. */
export function traceCommandTimings(events: readonly ClientGatewayTraceEvent[]): TraceCommandTimings {
  const sent = new Map<string, { group: string; at: number }>();
  const answeredAt = new Map<string, number>();
  for (const event of events) {
    const commandId = event.correlation.commandId;
    if (commandId === null) continue;
    if (event.kind === "outbound" && !sent.has(commandId)) sent.set(commandId, { group: groupOf(event), at: event.time.logicalMs });
    if (event.kind === "inbound" && sent.has(commandId) && !answeredAt.has(commandId)) answeredAt.set(commandId, event.time.logicalMs);
  }
  const byMessageType: Record<string, { count: number; totalMs: number; maxMs: number }> = {};
  for (const [commandId, command] of sent) {
    const group = (byMessageType[command.group] ??= { count: 0, totalMs: 0, maxMs: 0 });
    group.count += 1;
    const answer = answeredAt.get(commandId);
    if (answer === undefined) continue;
    const elapsed = Math.max(0, answer - command.at);
    group.totalMs += elapsed;
    group.maxMs = Math.max(group.maxMs, elapsed);
  }
  return Object.freeze({ commands: sent.size, answered: answeredAt.size, byMessageType: Object.freeze(byMessageType) });
}

function groupOf(event: ClientGatewayTraceEvent): string {
  const type = event.messageType !== null && IDENTIFIER.test(event.messageType) ? event.messageType : "other";
  if (type !== "server.execute_action") return type;
  const actionType = actionTypeOf(event);
  return `${type}:${actionType !== undefined && IDENTIFIER.test(actionType) ? actionType : "other"}`;
}

/** The command's `actionType`, or undefined when its payload holds none (an unparsable payload is grouped as "other"). */
function actionTypeOf(event: ClientGatewayTraceEvent): string | undefined {
  const parsed = tracePayloadValue(event.payload);
  const value = parsed.kind === "value" ? parsed.value : undefined;
  const inner = isRecord(value) && isRecord(value.payload) ? value.payload : undefined;
  return typeof inner?.actionType === "string" ? inner.actionType : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
