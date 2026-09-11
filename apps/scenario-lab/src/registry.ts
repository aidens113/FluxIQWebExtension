import { basicFormScenario } from "./scenarios/basic-form/index.js";
import { dynamicListScenario } from "./scenarios/dynamic-list/index.js";
import { navigationScenario } from "./scenarios/navigation/index.js";
import { longDocumentScenario } from "./scenarios/long-document/index.js";
import { iframeCheckoutScenario } from "./scenarios/iframe-checkout/index.js";
import { ambiguousTargetsScenario } from "./scenarios/ambiguous-targets/index.js";
import { delayedUiScenario } from "./scenarios/delayed-ui/index.js";
import { failureSurfacesScenario } from "./scenarios/failure-surfaces/index.js";
import { reconnectScenario } from "./scenarios/reconnect/index.js";
import { sensitiveInputScenario } from "./scenarios/sensitive-input/index.js";
import { llmTargetDriftScenario } from "./scenarios/llm-target-drift/index.js";
import { instructionOnlyFormScenario } from "./scenarios/instruction-only-form/index.js";
import { productCatalogScenario } from "./scenarios/product-catalog/index.js";
import { dataTableScenario } from "./scenarios/data-table/index.js";
import { infiniteFeedScenario } from "./scenarios/infinite-feed/index.js";
import { modalFlowsScenario } from "./scenarios/modal-flows/index.js";
import { multiTabScenario } from "./scenarios/multi-tab/index.js";
import { fileTransferScenario } from "./scenarios/file-transfer/index.js";
import { authGateScenario } from "./scenarios/auth-gate/index.js";
import { identityDriftScenario } from "./scenarios/identity-drift/index.js";
import { intermediateStateScenario } from "./scenarios/intermediate-state/index.js";
import { keyboardFormsScenario } from "./scenarios/keyboard-forms/index.js";
import type { ScenarioDefinition, ScenarioId } from "./types.js";
import type { WebScenario } from "@fluxiq-web-extension/test-contracts";

const registry = new Map<ScenarioId, ScenarioDefinition>([
  [basicFormScenario.id, basicFormScenario],
  [dynamicListScenario.id, dynamicListScenario],
  [navigationScenario.id, navigationScenario],
  [longDocumentScenario.id, longDocumentScenario],
  [iframeCheckoutScenario.id, iframeCheckoutScenario],
  [ambiguousTargetsScenario.id, ambiguousTargetsScenario],
  [delayedUiScenario.id, delayedUiScenario],
  [failureSurfacesScenario.id, failureSurfacesScenario],
  [reconnectScenario.id, reconnectScenario],
  [sensitiveInputScenario.id, sensitiveInputScenario],
  [llmTargetDriftScenario.id, llmTargetDriftScenario],
  [instructionOnlyFormScenario.id, instructionOnlyFormScenario],
  [productCatalogScenario.id, productCatalogScenario],
  [dataTableScenario.id, dataTableScenario],
  [infiniteFeedScenario.id, infiniteFeedScenario],
  [modalFlowsScenario.id, modalFlowsScenario],
  [multiTabScenario.id, multiTabScenario],
  [fileTransferScenario.id, fileTransferScenario],
  [authGateScenario.id, authGateScenario],
  [identityDriftScenario.id, identityDriftScenario],
  [intermediateStateScenario.id, intermediateStateScenario],
  [keyboardFormsScenario.id, keyboardFormsScenario],
]);

export function getScenario(id: string): ScenarioDefinition | undefined {
  return registry.get(id as ScenarioId);
}

export function listScenarios(): ScenarioDefinition[] {
  return [...registry.values()];
}

export function getScenarioManifest(id: string): WebScenario | undefined {
  return getScenario(id)?.manifest;
}

export function listScenarioManifests(): WebScenario[] {
  return listScenarios().map((scenario) => scenario.manifest);
}
