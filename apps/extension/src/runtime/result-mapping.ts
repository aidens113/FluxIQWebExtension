import {
  webAutomationActionFromGatewayCommand,
  webAutomationActionResultPayload,
  webAutomationActionTargetFromElement,
  webAutomationActionVisualTargetFromElement,
  type WebAutomationActionRejection
} from "@fluxiq-web-extension/domain/client";
import type {
  BrowserActionCommand,
  BrowserActionResult,
  ClientGatewayActionCommand,
  ClientGatewayActionResult,
  JsonObject
} from "../shared/protocol";

/**
 * The browser command a gateway command runs, or the domain's rejection when
 * its action type is unknown. A rejection carries Core's structured failure
 * record, is answered at once, and never reaches the page.
 */
export function browserActionFromGatewayCommand(command: ClientGatewayActionCommand & { commandId: string }): BrowserActionCommand | WebAutomationActionRejection {
  const mapped = webAutomationActionFromGatewayCommand(command);
  return isWebAutomationActionRejection(mapped) ? mapped : mapped as BrowserActionCommand;
}

export function isWebAutomationActionRejection(value: object): value is WebAutomationActionRejection {
  return "status" in value && value.status === "rejected" && "failure" in value;
}

/**
 * The gateway result for a rejected command. The wire has no "rejected" status,
 * so the rejection is reported as a failed result whose `failure` is the
 * domain's Core failure record (plan decision D11); `metadata` keeps the
 * requested action type exactly as it was sent.
 */
export function gatewayActionResultFromRejection(rejection: WebAutomationActionRejection): ClientGatewayActionResult {
  return {
    commandId: rejection.commandId,
    status: "failed",
    completedAt: Date.now(),
    message: rejection.message,
    error: rejection.message,
    failure: rejection.failure,
    metadata: { requestedActionType: rejection.actionType }
  };
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
    // Every status that is not a success carries its message as the error.
    // `timed_out` and `cancelled` used to reach the gateway with none, while
    // the panel showed the same result as failed with one (found by
    // w1-extension-unit-tests); the status itself is passed through untouched.
    error: result.status === "succeeded" ? undefined : result.message,
    // Core's structured failure record, built by the content script or by a
    // worker-side action. Without this the record was assembled and then
    // dropped at the boundary, so the gateway saw only a message string.
    failure: result.failure
  }) as ClientGatewayActionResult;
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}
