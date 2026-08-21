import {
  webAutomationActionFromGatewayCommand,
  webAutomationActionResultPayload,
  webAutomationActionTargetFromElement,
  webAutomationActionVisualTargetFromElement
} from "@fluxiq-web-extension/domain/client";
import type {
  BrowserActionCommand,
  BrowserActionResult,
  ClientGatewayActionCommand,
  ClientGatewayActionResult,
  JsonObject
} from "../shared/protocol";

export function browserActionFromGatewayCommand(command: ClientGatewayActionCommand & { commandId: string }): BrowserActionCommand {
  return webAutomationActionFromGatewayCommand(command) as BrowserActionCommand;
}

export function gatewayActionResultFromBrowserResult(result: BrowserActionResult): ClientGatewayActionResult {
  const visualTarget = result.visualTarget ?? (result.element
    ? webAutomationActionVisualTargetFromElement(result.element as never)
    : undefined);
  return compactObject({
    commandId: result.commandId,
    status: result.status,
    startedAt: result.startedAt,
    completedAt: result.finishedAt,
    message: result.message,
    target: result.element ? webAutomationActionTargetFromElement(result.element as never) as unknown as JsonObject : undefined,
    payload: compactObject({
      ...webAutomationActionResultPayload(result as never),
      visualTarget: visualTarget as unknown as JsonObject
    }) as JsonObject,
    error: result.status === "failed" ? result.message : undefined
  }) as ClientGatewayActionResult;
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}
