// The gateway mapping for the fact check (plan B1): which incoming command is
// one, the request it carries, and the payload its answer leaves the browser
// as. Beside `gateway-mapping.ts` rather than in it because a fact check is not
// a web action: `webAutomationActionFromGatewayCommand` would refuse its
// action type as unsupported, so the extension asks this first.

import type { ClientGatewayActionCommand } from "@fluxiq/client-gateway-websocket";
import type { JsonObject } from "fluxiq/core";
import {
  WEB_AUTOMATION_FACT_CHECK_ACTION_TYPE,
  webAutomationFactCheckRequestValue,
  webAutomationFactCheckResultValue,
  type WebAutomationFactCheckReading,
  type WebAutomationFactCheckResult
} from "../actions/fact-check";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "../runtime/failure";
import type { WebAutomationActionRejection } from "./gateway-mapping";

/** A fact-check command the page can be asked. */
export type WebAutomationFactCheckCommand = { commandId: string; request: WebAutomationFactCheckReading };

/**
 * The fact check a gateway command carries, a rejection when it is one whose
 * parameters hold no query list, or `undefined` when the command is not a fact
 * check at all and belongs to the action path.
 */
export function webAutomationFactCheckFromGatewayCommand(
  command: ClientGatewayActionCommand & { commandId: string }
): WebAutomationFactCheckCommand | WebAutomationActionRejection | undefined {
  if (command.actionType !== WEB_AUTOMATION_FACT_CHECK_ACTION_TYPE) return undefined;
  const request = webAutomationFactCheckRequestValue(command.parameters);
  if (request) return { commandId: command.commandId, request };
  const failure = webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.INVALID_PARAMETER, {
    expected: `${WEB_AUTOMATION_FACT_CHECK_ACTION_TYPE} with a list of queries`,
    actual: "the queries could not be read, so the page was not asked"
  });
  return { commandId: command.commandId, status: "rejected", actionType: command.actionType, message: `Not dispatched: ${failure.actual}.`, failure };
}

/** The answer's gateway payload, rebuilt field by field so nothing but the declared, bounded evidence leaves the browser. */
export function webAutomationFactCheckResultPayload(result: WebAutomationFactCheckResult): JsonObject {
  const rebuilt = webAutomationFactCheckResultValue(result) ?? { answers: [] };
  return rebuilt as unknown as JsonObject;
}
