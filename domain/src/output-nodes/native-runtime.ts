import type { JsonObject, JsonValue } from "fluxiq/core";
import type {
  AutomationStudioImporterImplementationBundle,
  AutomationStudioImporterSdkManifest,
  AutomationStudioNativeNodeImplementation
} from "fluxiq/automation-studio/nodes";
import type { AutomationNodeExecutionResult } from "fluxiq/automation-studio/nodes";
import { WEB_AUTOMATION_DOMAIN_ID } from "../constants";
import { WEB_AUTOMATION_ACTION_TYPES } from "../actions/types";
import type { WebAutomationActionType } from "../actions/types";
import { webAutomationOutputNodeDefinitions } from "./definitions";
import { webAutomationExtractListDispatch } from "./extract-list";
import { webAutomationOutputNodeParameterContracts } from "./parameter-contracts";

export const WEB_AUTOMATION_IMPORTER_PACKAGE_ID = "@fluxiq-web-extension/domain";
export const WEB_AUTOMATION_IMPORTER_PACKAGE_VERSION = "0.1.0";
export const WEB_AUTOMATION_RUNTIME_CAPABILITIES = ["web.actions"] as const;
export const WEB_AUTOMATION_RUNTIME_PERMISSIONS = ["web-automation.action"] as const;

export function createWebAutomationOutputNodeManifest(
  extension: Partial<Omit<AutomationStudioImporterSdkManifest, "schemaVersion" | "sdkVersion" | "packageId" | "packageVersion" | "domainId" | "nodes">> = {}
): AutomationStudioImporterSdkManifest {
  return {
    schemaVersion: "0.1",
    sdkVersion: "0.1",
    packageId: WEB_AUTOMATION_IMPORTER_PACKAGE_ID,
    packageVersion: WEB_AUTOMATION_IMPORTER_PACKAGE_VERSION,
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    nodes: webAutomationOutputNodeDefinitions,
    ...extension
  };
}

export function createWebAutomationOutputNodeImplementationBundle(
  extension: Partial<Omit<AutomationStudioImporterImplementationBundle, "packageId" | "packageVersion" | "implementations">> = {}
): AutomationStudioImporterImplementationBundle {
  return {
    packageId: WEB_AUTOMATION_IMPORTER_PACKAGE_ID,
    packageVersion: WEB_AUTOMATION_IMPORTER_PACKAGE_VERSION,
    implementations: Object.fromEntries(
      WEB_AUTOMATION_ACTION_TYPES.map((outputId) => [outputId, createOutputNodeImplementation(outputId)])
    ),
    // Core checks these when a Flow is planned, so a malformed extraction a
    // model wrote is refused before anything runs rather than at dispatch.
    parameterContracts: { ...webAutomationOutputNodeParameterContracts },
    ...extension
  };
}

/**
 * The node implementation runs *before* its output is dispatched: Core executes
 * it, then dispatches the effects it returned and merges the dispatcher's
 * status, message, and failure record over this result
 * (`runtime/executor/node-execution.ts`, `dispatchAutomationStudioEffects`).
 * It therefore cannot report the command's outcome, and must not pretend to —
 * status fidelity is carried by `io/gateway-output-dispatcher.ts`, which gives
 * Core the command's own `status`, `failure`, and promoted message, and by
 * `runtime/adapter.ts` on the runtime path. What this file owes Core is one
 * dispatch effect naming its own output, which `tests/native-runtime.test.ts`
 * pins.
 *
 * The list extraction also owes Core the dataset its rows are saved into, and
 * refuses to read a list it could not save (`extract-list/dispatch.ts`). That
 * refusal is about the node's own configuration, decided before anything runs,
 * not a guess at the command's outcome.
 */
function createOutputNodeImplementation(outputId: WebAutomationActionType): AutomationStudioNativeNodeImplementation {
  return (context): AutomationNodeExecutionResult => {
    const parameters = compactJsonObject(context.parameters);
    if (outputId !== "web.dom.extract_list") return dispatching({ outputId, parameters });
    const extraction = webAutomationExtractListDispatch(parameters);
    return extraction.ok ? dispatching({ outputId, ...extraction.payload }) : extraction.result;
  };
}

function dispatching(payload: JsonObject): AutomationNodeExecutionResult {
  return {
    status: "success",
    route: "success",
    outputs: { success: true },
    effects: [{ type: "policy.output.dispatch", payload }]
  };
}

function compactJsonObject(value: Readonly<Record<string, JsonValue>>): JsonObject {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  ) as JsonObject;
}
