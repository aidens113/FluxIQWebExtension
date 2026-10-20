// The last delivery points of a stored trace, by name only: where a run's
// gateway traffic stopped, what Core received last and what it derived (its
// disposition, a synthesized outcome), and which commands no answer reached.
// Each row keeps closed protocol names read from known fields (action type,
// statuses, failure code and stage, disposition, episode activity); a value
// that does not look like a protocol name is withheld. Commands are named by
// their ordinal in the trace (`c1`, `c2`, ...), never by id.

import type { ClientGatewayTraceEvent, ClientGatewayTraceParityEntry } from "fluxiq/client-gateway";
import type { DeliveryTail, DeliveryTailRow } from "./types.js";

const PROTOCOL_NAME = /^[A-Za-z][A-Za-z0-9_.:-]{0,80}$/;
export const WITHHELD_NAME = "(withheld)";

export function deliveryTail(events: readonly ClientGatewayTraceEvent[], entries: readonly ClientGatewayTraceParityEntry[] | null, length: number): DeliveryTail {
  const ordinals = new Map<string, string>();
  const ordinalOf = (commandId: string | null): string | null => {
    if (commandId === null) return null;
    let ordinal = ordinals.get(commandId);
    if (ordinal === undefined) ordinals.set(commandId, (ordinal = `c${ordinals.size + 1}`));
    return ordinal;
  };
  const issued: string[] = [];
  const answered = new Set<string>();
  const parity = new Map((entries ?? []).map(entry => [entry.sequence, entry.status] as const));
  const rows: DeliveryTailRow[] = events.map(event => {
    const command = ordinalOf(event.correlation.commandId);
    if (command !== null && event.kind === "outbound" && event.messageType === "server.execute_action") issued.push(command);
    if (command !== null && ((event.kind === "inbound" && event.messageType === "client.action_result") || event.kind === "synthesized")) answered.add(command);
    return Object.freeze({
      sequence: event.sequence, logicalMs: event.time.logicalMs, kind: event.kind, messageType: event.messageType, command,
      names: namesOf(event), parity: parity.get(event.sequence) ?? null,
    });
  });
  const last = events.at(-1);
  return Object.freeze({
    rows: Object.freeze(rows.slice(Math.max(0, rows.length - Math.max(0, length)))),
    commands: issued.length,
    unanswered: Object.freeze(issued.filter(command => !answered.has(command))),
    lastEventMs: last === undefined ? null : last.time.logicalMs,
  });
}

/** The closed names a row keeps, by the message's kind and type. */
function namesOf(event: ClientGatewayTraceEvent): Readonly<Record<string, string>> {
  const value = valueOf(event);
  const body = record(value?.payload);
  const names: Record<string, string> = {};
  const keep = (name: string, field: unknown): void => {
    if (field === undefined || field === null) return;
    names[name] = typeof field === "string" && PROTOCOL_NAME.test(field) ? field : WITHHELD_NAME;
  };
  if (event.kind === "outbound") {
    keep("action", body?.actionType);
    keep("leaseRole", record(record(body?.lease)?.holder)?.role);
  } else if (event.kind === "inbound" && event.messageType === "client.action_result") {
    keep("status", body?.status);
    keep("resultStatus", record(body?.payload)?.status);
    keep("failureCode", record(body?.failure)?.code);
    keep("failureStage", record(body?.failure)?.stage);
  } else if (event.kind === "inbound" && event.messageType === "client.recording_event") {
    keep("eventType", body?.eventType);
  } else if (event.kind === "disposition") {
    keep("disposition", value?.disposition);
    keep("error", value?.error);
  } else if (event.kind === "synthesized") {
    keep("outcome", value?.outcome);
    keep("code", value?.code);
    keep("reconcileState", value?.reconcileState);
  } else if (event.kind === "control") {
    keep("activity", value?.activity);
    keep("termination", value?.terminationReason);
  } else if (event.kind === "lifecycle") {
    keep("event", value?.event);
  }
  return Object.freeze(names);
}

/** The message as an object: a structured payload, or raw text that parses as one; text that is not JSON names nothing. */
function valueOf(event: ClientGatewayTraceEvent): Record<string, unknown> | undefined {
  if (event.payload.encoding === "json") return record(event.payload.value);
  if (event.payload.encoding !== "text") return undefined;
  try {
    return record(JSON.parse(event.payload.text) as unknown);
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
