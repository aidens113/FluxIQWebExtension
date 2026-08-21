import type { JsonObject } from "fluxiq/core";
import type { FluxIQRuntimeCommandResult } from "fluxiq/runtime";

export function webAutomationRuntimeTracePayload(result: FluxIQRuntimeCommandResult): JsonObject {
  return {
    commandId: result.commandId,
    status: result.status,
    ...(result.startedAt !== undefined ? { startedAt: result.startedAt } : {}),
    ...(result.completedAt !== undefined ? { completedAt: result.completedAt } : {}),
    ...(result.message ? { message: result.message } : {}),
    ...(result.error ? { error: result.error } : {}),
    ...(result.target ? { target: result.target } : {}),
    ...(result.payload ? { payload: result.payload } : {}),
    ...(result.metadata ? { metadata: result.metadata } : {})
  };
}
