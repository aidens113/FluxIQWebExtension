import type { ClientGatewayActionCommand, ClientGatewayActionResult, ClientGatewayDurableActionOptions } from "fluxiq/client-gateway";
import type { JsonObject } from "fluxiq/core";
import type { InstalledBuild } from "../../index";

/** Observes both public dispatch overloads while forwarding the original durable command context unchanged. */
export function observePhotoActions(installed: InstalledBuild) {
  const gateway = installed.fluxiq.programs.automationStudioClientGateway;
  const execute = gateway.executeAction.bind(gateway);
  const actions: Array<{ action: string; skipped?: unknown; toggle?: unknown; toggleBefore?: unknown }> = [];
  const observed = (command: ClientGatewayActionCommand, result: ClientGatewayActionResult) => {
    const payload: JsonObject = typeof result.payload === "object" && result.payload !== null && !Array.isArray(result.payload) ? result.payload : {};
    actions.push({ action: command.actionType, ...(payload.skipped ? { skipped: payload.skipped } : {}),
      ...(payload.toggle ? { toggle: payload.toggle } : {}), ...(payload.toggleBefore ? { toggleBefore: payload.toggleBefore } : {}) });
  };
  function dispatch(sessionId: string, command: ClientGatewayActionCommand): Promise<ClientGatewayActionResult>;
  function dispatch(sessionId: string, command: ClientGatewayActionCommand, options: ClientGatewayDurableActionOptions): ReturnType<typeof execute>;
  async function dispatch(sessionId: string, command: ClientGatewayActionCommand, options?: ClientGatewayDurableActionOptions): Promise<ClientGatewayActionResult | Awaited<ReturnType<typeof execute>>> {
    if (options !== undefined) {
      const outcome = await execute(sessionId, command, options);
      if (outcome.status === "completed") observed(command, outcome.result);
      return outcome;
    }
    const result = await execute(sessionId, command);
    observed(command, result);
    return result;
  }
  gateway.executeAction = dispatch;
  return actions;
}
