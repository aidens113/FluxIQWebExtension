import type { FluxIQRuntimeCommand, FluxIQRuntimeCommandResult } from "fluxiq/runtime";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../constants";
import type { WebAutomationActionType } from "../actions/types";

export type WebAutomationRuntimeCommand = FluxIQRuntimeCommand & {
  domainId: typeof WEB_AUTOMATION_DOMAIN_ID;
  outputId: WebAutomationActionType;
  actionType: WebAutomationActionType;
};

export function webAutomationRuntimeCommandFromOutput(input: {
  commandId?: string;
  outputId: WebAutomationActionType;
  parameters?: JsonObject;
  target?: JsonObject;
  timeoutMs?: number;
  metadata?: JsonObject;
}): WebAutomationRuntimeCommand {
  return {
    ...(input.commandId ? { commandId: input.commandId } : {}),
    kind: "execute_action",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    outputId: input.outputId,
    actionType: input.outputId,
    parameters: input.parameters ?? {},
    ...(input.target ? { target: input.target } : {}),
    ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {})
  };
}

export function webAutomationOutputResultFromRuntimeResult(result: FluxIQRuntimeCommandResult): JsonObject {
  return compact({
    runtimeCommandId: result.commandId,
    status: result.status,
    message: result.message,
    error: result.error,
    target: result.target,
    result: result.payload,
    metadata: result.metadata
  });
}

function compact(value: Record<string, unknown>): JsonObject {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as JsonObject;
}
