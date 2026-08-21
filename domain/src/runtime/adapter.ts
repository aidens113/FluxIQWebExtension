import type { FluxIQRuntimeAdapter, FluxIQRuntimeCommand, FluxIQRuntimeCommandResult } from "fluxiq/runtime";
import type { FluxIQ } from "fluxiq";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../constants";
import { WEB_AUTOMATION_ACTION_TYPES } from "../actions/types";
import { dispatchWebAutomationOutput } from "../io/gateway-output-dispatcher";
import { outputTargetFromPayload } from "../output-nodes";
import { webAutomationRuntimeCapabilities } from "./capabilities";

export type WebAutomationRuntimeAdapterOptions = {
  fluxiq: FluxIQ;
  adapterId?: string;
  label?: string;
};

export function createWebAutomationRuntimeAdapter(options: WebAutomationRuntimeAdapterOptions): FluxIQRuntimeAdapter {
  return {
    adapterId: options.adapterId ?? "web-automation.gateway",
    label: options.label ?? "Web Automation Gateway Runtime",
    transport: "direct",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    capabilities: () => webAutomationRuntimeCapabilities,
    canExecute: (command) => canExecuteWebAutomationCommand(command),
    execute: (command) => executeWebAutomationRuntimeCommand(options.fluxiq, command),
    captureSnapshot: (command) => captureWebAutomationSnapshot(options.fluxiq, command),
    readState: (command) => captureWebAutomationSnapshot(options.fluxiq, command)
  };
}

function canExecuteWebAutomationCommand(command: FluxIQRuntimeCommand): boolean {
  if (command.domainId !== undefined && command.domainId !== WEB_AUTOMATION_DOMAIN_ID) return false;
  if (command.kind === "capture_snapshot" || command.kind === "read_state") return true;
  if (command.kind !== "execute_action") return false;
  const outputId = command.outputId ?? command.actionType;
  return WEB_AUTOMATION_ACTION_TYPES.includes(outputId as never);
}

async function executeWebAutomationRuntimeCommand(fluxiq: FluxIQ, command: FluxIQRuntimeCommand): Promise<FluxIQRuntimeCommandResult> {
  const outputId = command.outputId ?? command.actionType;
  if (!outputId || !WEB_AUTOMATION_ACTION_TYPES.includes(outputId as never)) {
    return rejected(command, `Unsupported web automation output: ${outputId ?? "(missing)"}`);
  }
  const payload = command.parameters ?? {};
  const startedAt = Date.now();
  const request: Parameters<typeof dispatchWebAutomationOutput>[1] = {
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    outputId,
    payload
  };
  if (command.metadata) request.metadata = command.metadata;
  const result = await dispatchWebAutomationOutput(fluxiq, request);
  const runtimeResult: FluxIQRuntimeCommandResult = {
    commandId: command.commandId ?? `web.${Date.now()}`,
    status: result.ok ? "succeeded" : "failed",
    startedAt,
    completedAt: Date.now(),
    ...(result.error ? { error: result.error } : {}),
    ...(result.error ? { message: result.error } : {}),
    metadata: compact({ outputId, ...(result.metadata ?? {}) })
  };
  if (result.payload !== undefined) runtimeResult.payload = result.payload;
  const target = outputTargetFromPayload(payload as JsonObject);
  if (target) runtimeResult.target = target;
  return runtimeResult;
}

async function captureWebAutomationSnapshot(fluxiq: FluxIQ, command: FluxIQRuntimeCommand): Promise<FluxIQRuntimeCommandResult> {
  const session = selectWebAutomationSession(fluxiq, command.metadata);
  if (!session) return rejected(command, "A single paired web-automation client must be selected before capturing state.");
  await fluxiq.programs.clientGateway.captureSnapshot(session.sessionId, {
    kind: command.kind === "read_state" ? "state" : "structured",
    ...(command.metadata ? { metadata: command.metadata } : {})
  });
  return {
    commandId: command.commandId ?? `web.snapshot.${Date.now()}`,
    status: "succeeded",
    completedAt: Date.now(),
    message: "Snapshot command dispatched to web automation client.",
    metadata: { sessionId: session.sessionId, clientId: session.clientId }
  };
}

function selectWebAutomationSession(fluxiq: FluxIQ, metadata: JsonObject | undefined) {
  const requestedSessionId = typeof metadata?.sessionId === "string" ? metadata.sessionId : undefined;
  const sessions = fluxiq.programs.clientGateway.snapshot().sessions.filter((session) =>
    (session.status === "connected" || session.status === "ready") &&
    session.clientType === "extension" &&
    session.capabilities.some((capability) =>
      capability.id === "web.actions" &&
      (capability.metadata?.domainId === WEB_AUTOMATION_DOMAIN_ID || capability.actionTypes?.some((actionType) => actionType.startsWith("web.")))
    )
  );
  if (requestedSessionId) return sessions.find((session) => session.sessionId === requestedSessionId);
  return sessions.length === 1 ? sessions[0] : undefined;
}

function rejected(command: FluxIQRuntimeCommand, message: string): FluxIQRuntimeCommandResult {
  return {
    commandId: command.commandId ?? `web.rejected.${Date.now()}`,
    status: "rejected",
    completedAt: Date.now(),
    message,
    error: message
  };
}

function compact(value: Record<string, unknown>): JsonObject {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as JsonObject;
}
