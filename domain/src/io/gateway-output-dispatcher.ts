import type { FluxIQ, OutputDispatchRequest, OutputDispatchResult } from "fluxiq";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../constants";
import { outputTargetFromPayload } from "../output-nodes";

export async function dispatchWebAutomationOutput(
  fluxiq: FluxIQ,
  request: OutputDispatchRequest<JsonObject>
): Promise<OutputDispatchResult<JsonObject>> {
  const sessionId = targetSessionId(fluxiq, request.metadata);
  if (!sessionId) return { ok: false, outputId: request.outputId, error: "A single paired web-automation client must be selected before dispatching an output." };
  try {
    const target = outputTargetFromPayload(request.payload);
    const command = target ? {
      actionType: request.outputId,
      parameters: request.payload,
      target
    } : {
      actionType: request.outputId,
      parameters: request.payload
    };
    const result = await fluxiq.programs.automationStudioClientGateway.executeAction(sessionId, command);
    return {
      ok: result.status === "succeeded",
      outputId: request.outputId,
      payload: compact({ status: result.status, message: result.message, result: result.payload }),
      ...(result.error ? { error: result.error } : {})
    };
  } catch (error) {
    return { ok: false, outputId: request.outputId, error: error instanceof Error ? error.message : "Web automation output dispatch failed." };
  }
}

function targetSessionId(fluxiq: FluxIQ, metadata: JsonObject | undefined): string | undefined {
  const requested = stringValue(metadata?.sessionId);
  const eligible = fluxiq.programs.clientGateway.snapshot().sessions.filter((session) =>
    (session.status === "connected" || session.status === "ready") &&
    session.clientType === "extension" &&
    session.capabilities.some((capability) =>
      capability.id === "web.actions" &&
      (capability.metadata?.domainId === WEB_AUTOMATION_DOMAIN_ID || capability.actionTypes?.some((actionType) => actionType.startsWith("web.")))
    )
  );
  if (requested) return eligible.some((session) => session.sessionId === requested) ? requested : undefined;
  return eligible.length === 1 ? eligible[0]?.sessionId : undefined;
}

function compact(value: Record<string, unknown>): JsonObject {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as JsonObject;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
