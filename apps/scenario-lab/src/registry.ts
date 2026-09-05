import { basicFormScenario } from "./scenarios/basic-form/scenario.js";
import { dynamicListScenario } from "./scenarios/dynamic-list/scenario.js";
import { navigationScenario } from "./scenarios/navigation/scenario.js";
import { longDocumentScenario } from "./scenarios/long-document/scenario.js";
import { iframeCheckoutScenario } from "./scenarios/iframe-checkout/scenario.js";
import { ambiguousTargetsScenario } from "./scenarios/ambiguous-targets/scenario.js";
import { delayedUiScenario } from "./scenarios/delayed-ui/scenario.js";
import { failureSurfacesScenario } from "./scenarios/failure-surfaces/scenario.js";
import { reconnectScenario } from "./scenarios/reconnect/scenario.js";
import { sensitiveInputScenario } from "./scenarios/sensitive-input/scenario.js";
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
