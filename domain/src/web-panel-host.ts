import type { FluxIQ } from "fluxiq";
import { AutomationStudioNativeNodeRuntime, type AutomationStudioRecordingMapperCandidate, type AutomationStudioRecordingMapperObservation } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_ACTION_TYPES } from "./actions/types";
import { WEB_AUTOMATION_DOMAIN_ID } from "./constants";
import { GatewayInputHub } from "./io/gateway-input-hub";
import { dispatchWebAutomationOutput } from "./io/gateway-output-dispatcher";
import { webAutomationRecordedAction } from "./io/input-model";
import { webAutomationManifestInputs, webAutomationManifestOutputs } from "./io/manifest-definitions";
import { webAutomationDomain } from "./manifest";
import {
  createWebAutomationOutputNodeImplementationBundle,
  createWebAutomationOutputNodeManifest,
  WEB_AUTOMATION_IMPORTER_PACKAGE_ID,
  WEB_AUTOMATION_IMPORTER_PACKAGE_VERSION,
  WEB_AUTOMATION_RUNTIME_CAPABILITIES,
  WEB_AUTOMATION_RUNTIME_PERMISSIONS
} from "./output-nodes/native-runtime";
import { webAutomationRecordingDomain } from "./recording/domain";
import { WEB_AUTOMATION_STATE_NAMESPACE } from "./recording/state";
import { WEB_AUTOMATION_VIEWPORT_VISUALIZER_ID } from "./recording/web-state";
import { webAutomationOutputPayload } from "./web-panel/output-nodes";
import { registerWebAutomationRuntime } from "./runtime/service";

const RECORDING_MAPPER_ID = "web-recording-actions";

/**
 * Entry point loaded by the FluxIQ web process. It deliberately owns the
 * trusted-local recording mapper binding; the generic web application cannot
 * infer or import importer code on its own.
 */
export function registerFluxIQHost(fluxiq: FluxIQ): FluxIQ {
  if (!fluxiq.domains.maybeGet(WEB_AUTOMATION_DOMAIN_ID)) {
    fluxiq.registerDomain(webAutomationDomain);
  }
  if (!fluxiq.ioSnapshot(WEB_AUTOMATION_DOMAIN_ID).inputs.length) {
    const liveInputs = new GatewayInputHub(fluxiq);
    fluxiq.registerDomainIo({
      domainId: WEB_AUTOMATION_DOMAIN_ID,
      inputs: webAutomationManifestInputs.map((definition) => {
        const outputId = "outputId" in definition ? definition.outputId : undefined;
        return {
          definition,
          mode: "stream" as const,
          subscribe: (handler) => liveInputs.subscribe(definition.id, handler),
          ...(typeof outputId === "string" ? {
            outputBinding: {
              outputId,
              toPayload: (event) => webAutomationOutputPayload(outputId, event.payload)
            }
          } : {})
        };
      }),
      outputs: webAutomationManifestOutputs.map((definition) => ({
        definition,
        mode: "request" as const,
        dispatch: (request) => dispatchWebAutomationOutput(fluxiq, request)
      }))
    });
  }
  if (!fluxiq.programs.automationStudio.listRecordingDomains().some((domain) => domain.domainId === WEB_AUTOMATION_DOMAIN_ID)) {
    fluxiq.programs.automationStudio.registerRecordingDomain(webAutomationRecordingDomain);
  }

  const nativeRuntime = new AutomationStudioNativeNodeRuntime({
    permissions: WEB_AUTOMATION_RUNTIME_PERMISSIONS,
    runtimeCapabilities: WEB_AUTOMATION_RUNTIME_CAPABILITIES
  }).register(createWebAutomationOutputNodeManifest({
    stateVisualizers: [{
      id: WEB_AUTOMATION_VIEWPORT_VISUALIZER_ID,
      version: WEB_AUTOMATION_IMPORTER_PACKAGE_VERSION,
      label: "Web viewport",
      description: "Renders browser DOM state as a viewport frame with anchored interactive elements.",
      supportedNamespaces: [WEB_AUTOMATION_STATE_NAMESPACE],
      supportedKinds: ["bounds", "text", "label", "selector", "url", "visibility", "enabled"],
      supportedRendererIds: [WEB_AUTOMATION_VIEWPORT_VISUALIZER_ID],
      metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID, packageId: WEB_AUTOMATION_IMPORTER_PACKAGE_ID }
    }],
    recordingMappers: [{
      id: RECORDING_MAPPER_ID,
      version: WEB_AUTOMATION_IMPORTER_PACKAGE_VERSION,
      description: "Maps recorded browser interactions to executable web automation actions.",
      outputIds: WEB_AUTOMATION_ACTION_TYPES
    }]
  }), createWebAutomationOutputNodeImplementationBundle({
    recordingMappers: {
      [RECORDING_MAPPER_ID]: mapWebRecordingObservation
    }
  }));

  // Bind through Automation Studio directly for compatibility with the
  // framework build currently linked by this importing repository.
  fluxiq.programs.automationStudio.bindNativeNodeRuntime(nativeRuntime);
  registerWebAutomationRuntime(fluxiq);
  return fluxiq;
}

/** Subflow node labels for the actions a recording can propose. */
const CANDIDATE_LABELS: Partial<Record<string, string>> = {
  "web.browser.navigate": "Navigate",
  "web.dom.click": "Click",
  "web.dom.type": "Enter text",
  "web.dom.clear": "Clear field",
  "web.dom.select": "Select option",
  "web.dom.keypress": "Press key",
  "web.dom.scroll": "Scroll"
};

/**
 * Recording -> Subflow mapper. It resolves each observation through the same
 * `webAutomationRecordedAction` the live gateway input path uses, so a
 * proposed node carries the parameters a live recording would have: the
 * selector together with the element fingerprint and visual target.
 */
export function mapWebRecordingObservation(observation: AutomationStudioRecordingMapperObservation): AutomationStudioRecordingMapperCandidate | null {
  const payload = recordedEventPayload(observation);
  const metadata = { ...(readObject(payload.metadata) ?? {}), ...observation.metadata } as JsonObject;
  const action = webAutomationRecordedAction(recordedEventType(observation), payload, metadata);
  return action ? candidate(action.outputId, action.parameters, action.inputId, CANDIDATE_LABELS[action.outputId] ?? action.outputId) : null;
}

/** Timeline mapper observations retain the entry kind, with domain events nested in their payload. */
function recordedEventType(observation: AutomationStudioRecordingMapperObservation): string {
  if (observation.type === "domain_event") return readString(observation.payload.eventType) ?? "";
  if (observation.type === "observation") return readString(observation.payload.observationType) ?? "";
  return observation.type;
}

function recordedEventPayload(observation: AutomationStudioRecordingMapperObservation): JsonObject {
  if (observation.type === "domain_event" || observation.type === "observation") {
    return (readObject(observation.payload.payload) ?? observation.payload) as JsonObject;
  }
  return observation.payload;
}

function candidate(outputId: string, parameters: JsonObject, sourceInputId: string, label: string): AutomationStudioRecordingMapperCandidate {
  return { outputId, parameters: compact(parameters), sourceInputIds: [sourceInputId], expectedConfirmation: { inputId: sourceInputId, timeoutMs: 5_000 }, confidence: 0.9, label };
}

function compact(value: Record<string, unknown>): JsonObject {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as JsonObject;
}

function readObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export default registerFluxIQHost;
