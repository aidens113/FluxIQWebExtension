import type { FluxIQ, OutputDispatchRequest, OutputDispatchResult } from "fluxiq";
import type { JsonObject } from "fluxiq/core";
import { ClientGatewayRequiredCommandContext } from "fluxiq/client-gateway";
import { webAutomationClearedCheckWaitValue } from "../actions/cleared-check-wait";
import { webAutomationInterruptedDispatchReading } from "../client/interrupted-action";
import { WEB_AUTOMATION_DOMAIN_ID } from "../constants";
import { outputTargetFromPayload } from "../output-nodes";

export async function dispatchWebAutomationOutput(
  fluxiq: FluxIQ,
  // `timeoutMs` is the time the client is given, sent as the gateway command's
  // own timeout when a caller has one: the runtime adapter passes its command's.
  // Core's IO output path has none, and a request without one sends none.
  request: OutputDispatchRequest<JsonObject> & { timeoutMs?: number }
): Promise<OutputDispatchResult<JsonObject>> {
  const required = Object.hasOwn(request, "commandContext");
  if (required) ClientGatewayRequiredCommandContext.assertRequired(request.commandContext!);
  const sessionId = targetSessionId(fluxiq, request.metadata);
  if (!sessionId) { if (required) await ClientGatewayRequiredCommandContext.stop(request.commandContext!, "web.no_selected_session"); return { ok: false, outputId: request.outputId, error: "A single paired web-automation client must be selected before dispatching an output." }; }
  try {
    const target = outputTargetFromPayload(request.payload);
    const command: { actionType: string; parameters: JsonObject; target?: JsonObject; timeoutMs?: number } = {
      actionType: request.outputId,
      parameters: request.payload
    };
    if (target) command.target = target;
    if (request.timeoutMs !== undefined) command.timeoutMs = request.timeoutMs;
    const result = required ? await (async () => {
      const outcome = await fluxiq.programs.automationStudioClientGateway.executeAction(sessionId, command, { context: request.commandContext!, ...(request.signal ? { signal: request.signal } : {}) });
      if (outcome.status !== "completed") { await ClientGatewayRequiredCommandContext.stop(request.commandContext!, outcome.status); throw new Error(`web.required_${outcome.status}`); }
      return outcome.result;
    })() : await fluxiq.programs.automationStudioClientGateway.executeAction(sessionId, command);
    // A command the browser lost in flight answers `interrupted` in its payload
    // (plan B3). Its status and record are decided again here from the command
    // this dispatch sent: a committing act is `unknown` and uncertain, any
    // other act a failure that did nothing (`client/interrupted-action/`).
    const interrupted = webAutomationInterruptedDispatchReading(request.outputId, request.payload, result.payload);
    const status = interrupted?.status ?? result.status;
    const failure = interrupted?.failure ?? result.failure;
    const succeeded = status === "succeeded";
    const message = interrupted?.message ?? stringValue(result.message);
    // A robot check that stood on the landed page and cleared by itself rides
    // the client's payload as `checkWait` (`actions/cleared-check-wait.ts`).
    // Core reads it as the result's own `clearedWait`, never off the payload, so
    // it is lifted here through the same bound; malformed or absent adds nothing.
    const clearedWait = webAutomationClearedCheckWaitValue(isRecord(result.payload) ? result.payload.checkWait : undefined);
    // A next-page step whose list has no next page answers `route: "ended"` on
    // the client's payload (`client/gateway-mapping.ts`). Core takes a
    // dispatched action's route from the top of the dispatch payload when the
    // node declares an output of that id (contract C1), so it is lifted there:
    // only that literal, and nothing otherwise. `runtime/adapter.ts` returns
    // this payload to Core as it is, so the runtime path carries it too.
    const route = isRecord(result.payload) && result.payload.route === "ended" ? "ended" : undefined;
    return {
      // `ok` stays the success flag; `status` is the command's own outcome, so
      // Core sees `timed_out` or `cancelled` rather than a bare failure.
      ok: succeeded,
      outputId: request.outputId,
      status,
      payload: compact({ status, message, result: result.payload, route }),
      // Core's IO path builds the node message from `error` alone
      // (`failedDispatchResult`), so a command that failed with only a message
      // — the usual shape of a client-side timeout or cancellation — would
      // otherwise arrive with no reason. A success never gains an error.
      ...(result.error ? { error: result.error } : !succeeded && message ? { error: message } : {}),
      ...(failure ? { failure } : {}),
      ...(clearedWait ? { clearedWait } : {})
    };
  } catch (error) {
    if (required) { await ClientGatewayRequiredCommandContext.stop(request.commandContext!, "web.required_dispatch_failed"); throw error; }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
