// A command payload the trace matcher hands over untyped (Core's
// `ClientGatewayTraceRecordedPayload`), read as the gateway action command the
// domain maps: the trial's changed command, or the recorded command replayed
// as the control (D37). Only the fields `webAutomationActionFromGatewayCommand`
// reads are taken, and each is checked first: an id and an action type that are
// strings, parameters, target and metadata that are objects when present, a
// timeout that is a finite number when present. Anything else is `undefined`:
// not a command this domain reads.

import type { ClientGatewayActionCommand } from "@fluxiq/client-gateway-websocket";
import type { ClientGatewayTraceRecordedPayload } from "fluxiq/client-gateway";
import type { JsonObject } from "fluxiq/core";

export function webOfflineReadGatewayCommand(value: ClientGatewayTraceRecordedPayload | null): (ClientGatewayActionCommand & { commandId: string }) | undefined {
  if (value === null || typeof value.commandId !== "string" || typeof value.actionType !== "string") return undefined;
  const { parameters, target, metadata, timeoutMs } = value;
  if (![parameters, target, metadata].every((field) => field === undefined || isRecord(field))) return undefined;
  if (timeoutMs !== undefined && (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs))) return undefined;
  const command: ClientGatewayActionCommand & { commandId: string } = { commandId: value.commandId, actionType: value.actionType };
  if (isRecord(parameters)) command.parameters = parameters as JsonObject;
  if (isRecord(target)) command.target = target as JsonObject;
  if (isRecord(metadata)) command.metadata = metadata as JsonObject;
  if (typeof timeoutMs === "number") command.timeoutMs = timeoutMs;
  return command;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
