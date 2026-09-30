import type { JsonObject, JsonValue } from "fluxiq/core";
import type { AutomationStudioFailureRecord } from "fluxiq/automation-studio";
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
import { webAutomationRecordValues } from "./targets";

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
    try {
      const parameters = scopedToRow(compactJsonObject(context.parameters), context.inputs?.item);
      if (outputId !== "web.dom.extract_list") return dispatching({ outputId, parameters });
      const extraction = webAutomationExtractListDispatch(parameters);
      return extraction.ok ? dispatching({ outputId, ...extraction.payload }) : extraction.result;
    } catch (error) {
      return implementationThrew(outputId, error);
    }
  };
}

/**
 * A throw out of this implementation, turned into the failed result Core can act
 * on.
 *
 * **Every one of this repository's eighteen output nodes runs outside Core's only
 * try/catch.** Core holds no `definition.execute` for `web.dom.click` and the
 * rest, so execution goes through `options.nativeNodeExecutor`
 * (`AS/runtime/executor/node-execution.ts:87`), which sits *outside* the try
 * block that guards `definition.execute` at lines 126-155. A throw from here
 * propagates out of `executeNodeAttempt`, out of the step loop, out of
 * `runGraphFromSeed`, to `service.ts`, which ends the session and rethrows: **no
 * attempt row, no ladder, no repair, and no trace row for the node that did it**
 * (`docs/working/language-driven-flow-loop-plan/reports/t163-defensive-runtime-audit.md`,
 * section 3, "Ends the run by escaping every guard").
 *
 * Core gaining that guard is the other half and belongs to Core. This half is the
 * one that does not depend on it: a fault that becomes a structured failure record
 * is a fault the runtime can act on, and a fault that escapes as an exception is
 * one nobody can -- so this implementation does not throw, whatever its callees do.
 *
 * `graph_validation_or_unknown_node` and `dispatch`, because nothing has been
 * dispatched: the node's own parameters could not be turned into a command, which
 * is a fault in the Flow rather than in the page, and not retryable for the same
 * reason -- the same parameters will not parse differently next time.
 */
function implementationThrew(outputId: WebAutomationActionType, error: unknown): AutomationNodeExecutionResult {
  const code = "output_node.implementation_threw";
  const detail = error instanceof Error && error.message.length > 0 ? error.message : "no message";
  const failure: AutomationStudioFailureRecord = {
    category: "graph_validation_or_unknown_node",
    code,
    retryable: false,
    stage: "dispatch",
    expected: `${outputId} to be turned into a browser command`,
    actual: `preparing the command threw: ${detail}`
  };
  return {
    status: "failed",
    route: "failed",
    effects: [],
    outputs: { error: { code, outputId } },
    message: `${outputId} could not be prepared, so nothing was sent to the browser.`,
    failure
  };
}

/**
 * The node's parameters with its recorded target scoped to the row a For Each
 * pass is on (t195).
 *
 * A loop over an extraction's rows ran its body's click on the element the build
 * recorded, so every pass pressed the same card's control (live runs
 * `run-munnop9n-5475d593`, `run-munnyvbr-11c28a0f`). Core hands the pass's row
 * to a body node that declares the `item` input (`definitions.ts`), as the
 * extraction's validated record: field key to string.
 *
 * The row replaces the recorded `element.context.record`, which named the row
 * the Flow was built on, with the row's own values. The page then accepts the
 * recorded control only inside a record holding every one of them
 * (`content/identity/record.ts`), and resolves the same control in that row
 * when the recorded selector answers with another (`resolve-target.ts`).
 *
 * Only where the build saw the control inside a repeated thing: a recorded
 * `record`, or -- for a node a model built from a snapshot handle, whose element
 * carries its list position and never a record
 * (`runtime/llm-evidence/plan-resolution/element-identity.ts`) -- a
 * `listPosition`. A control that sat in no repeated thing -- a dialog's Close,
 * the page's search box -- is the same control on every pass and is dispatched
 * untouched. So is everything when no row arrived, the row is not an object, or
 * it holds no non-empty string.
 */
function scopedToRow(parameters: JsonObject, item: JsonValue | undefined): JsonObject {
  if (!isJsonObject(item)) return parameters;
  const element = isJsonObject(parameters.element) ? parameters.element : undefined;
  const elementContext = element && isJsonObject(element.context) ? element.context : undefined;
  if (!element || !elementContext || !(isJsonObject(elementContext.record) || isJsonObject(elementContext.listPosition))) return parameters;
  const values = webAutomationRecordValues(Object.values(item));
  if (!values) return parameters;
  return { ...parameters, element: { ...element, context: { ...elementContext, record: { values } } } };
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
