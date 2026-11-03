import type { AutomationStudioFailureRecord } from "fluxiq/automation";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import { WEB_AUTOMATION_DEFINITION_FIELDS_CAPABILITY_ID } from "../capabilities";
import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "../failure";

/** Refuse an unsupported semantic read before any command reaches the selected browser. */
export function webDefinitionFieldCapabilityRefusal(actionType: string, parameters: unknown, session: unknown): { status: "failed"; message: string; failure: AutomationStudioFailureRecord } | undefined {
  if (actionType !== "web.dom.extract_list" || !requiresDefinition(parameters) || supportsDefinition(session)) return undefined;
  return {
    status: "failed",
    message: "Update the selected browser extension to read semantic definition fields, then reconnect it and try again. This read was not dispatched.",
    failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.NOT_IMPLEMENTED, {
      expected: "selected browser client declares web.extract.definition version 1 or later",
      actual: "selected browser client does not declare a supported semantic definition-field capability; read not dispatched"
    })
  };
}

/** Look at the active raw member too: malformed anchors must not reach an old reader that ignores them. */
function requiresDefinition(parameters: unknown): boolean {
  const request = record(record(parameters)?.extractList);
  if (request === undefined) return false;
  const fields = record(request.fields);
  return (fields !== undefined && Object.values(fields).some(activeDefinition))
    || (Array.isArray(request.where) && request.where.some((condition) => activeDefinition(record(condition)?.read)));
}

function activeDefinition(value: unknown): boolean {
  const field = record(value);
  return field?.kind === "text" && field.handling !== "exclude" && Object.hasOwn(field, "definition") && field.definition !== undefined;
}

function supportsDefinition(value: unknown): boolean {
  const session = record(value);
  return Array.isArray(session?.capabilities) && session.capabilities.some((entry) => {
    const capability = record(entry);
    const metadata = record(capability?.metadata);
    return capability?.id === WEB_AUTOMATION_DEFINITION_FIELDS_CAPABILITY_ID && metadata?.domainId === WEB_AUTOMATION_DOMAIN_ID
      && typeof metadata.version === "number" && Number.isSafeInteger(metadata.version) && metadata.version >= 1;
  });
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
