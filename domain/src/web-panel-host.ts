import type { FluxIQ } from "fluxiq";
import { AutomationStudioNativeNodeRuntime } from "../../../!FluxIQ/packages/fluxiq/dist/programs/automation-studio/runtime/native-node-runtime.js";
import type { JsonObject } from "fluxiq/core";
import type { AutomationStudioRecordingMapperCandidate, AutomationStudioRecordingMapperObservation } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_ACTION_TYPES } from "./actions/types";
import { WEB_AUTOMATION_DOMAIN_ID, WEB_AUTOMATION_EVENTS } from "./constants";
import { WEB_AUTOMATION_INPUT_IDS } from "./io/input-model";
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
import { outputTargetFromPayload, webAutomationOutputPayload } from "./web-panel/output-nodes";
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
        dispatch: async (request) => dispatchWebAction(fluxiq, request.outputId, request.payload)
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

/** Keeps confirmation inputs live while avoiding an ESM runtime import in the CJS host module. */
class GatewayInputHub {
  private readonly listeners = new Map<string, Set<(event: any) => void>>();

  constructor(fluxiq: FluxIQ) {
    fluxiq.programs.clientGateway.onEvent((event: any) => this.accept(event));
  }

  subscribe(inputId: string, handler: (event: any) => void): () => void {
    const handlers = this.listeners.get(inputId) ?? new Set<(event: any) => void>();
    handlers.add(handler);
    this.listeners.set(inputId, handlers);
    return () => {
      handlers.delete(handler);
      if (!handlers.size) this.listeners.delete(inputId);
    };
  }

  private accept(event: any): void {
    if (event.type !== "client.recording_event" && event.type !== "client.state_update") return;
    const messagePayload = readObject(event.message?.payload);
    const metadata = readObject(messagePayload?.metadata);
    if (readString(metadata?.domainId) !== WEB_AUTOMATION_DOMAIN_ID) return;
    const inputId = readString(metadata?.inputId);
    if (!inputId) return;
    const payload = event.type === "client.recording_event"
      ? (readObject(messagePayload?.payload) ?? {})
      : (readObject(messagePayload?.state) ?? messagePayload ?? {});
    const envelope = {
      id: event.message.id,
      domainId: WEB_AUTOMATION_DOMAIN_ID,
      ioId: inputId,
      sequence: readNumber(payload.sequence) ?? 0,
      timestampMs: event.message.timestamp ?? Date.now(),
      payload,
      metadata: { sessionId: event.session.sessionId, clientId: event.session.clientId, ...metadata }
    };
    for (const handler of this.listeners.get(inputId) ?? []) handler(envelope);
  }
}

async function dispatchWebAction(fluxiq: FluxIQ, outputId: string, payload: JsonObject): Promise<{ ok: boolean; outputId: string; payload?: JsonObject; error?: string }> {
  const sessions = fluxiq.programs.clientGateway.snapshot().sessions.filter((session) =>
    (session.status === "connected" || session.status === "ready") &&
    session.clientType === "extension" &&
    session.capabilities.some((capability) =>
      capability.id === "web.actions" &&
      (capability.metadata?.domainId === WEB_AUTOMATION_DOMAIN_ID || capability.actionTypes?.some((actionType) => actionType.startsWith("web.")))
    )
  );
  if (sessions.length !== 1) return { ok: false, outputId, error: "A single paired web-automation client must be selected before dispatching an output." };
  try {
    const target = outputTargetFromPayload(payload);
    const result = await fluxiq.programs.automationStudioClientGateway.executeAction(sessions[0]!.sessionId, {
      actionType: outputId,
      parameters: payload,
      ...(target ? { target } : {})
    });
    return { ok: result.status === "succeeded", outputId, payload: { status: result.status, ...(result.message ? { message: result.message } : {}), ...(result.payload ? { result: result.payload } : {}) }, ...(result.error ? { error: result.error } : {}) };
  } catch (error) {
    return { ok: false, outputId, error: error instanceof Error ? error.message : "Web automation output dispatch failed." };
  }
}

export function mapWebRecordingObservation(observation: AutomationStudioRecordingMapperObservation): AutomationStudioRecordingMapperCandidate | null {
  const eventType = recordedEventType(observation);
  const payload = recordedEventPayload(observation);
  const selector = readSelector(payload.element);
  const inputValue = readString(payload.inputValue);
  const key = readString(payload.key);

  if (eventType === WEB_AUTOMATION_EVENTS.pageNavigated) {
    const url = readString(payload.url);
    const metadata = { ...(readObject(payload.metadata) ?? {}), ...observation.metadata };
    return url && readString(metadata.reason) !== "recording_start" && readString(metadata.transition) === "typed"
      ? candidate("web.browser.navigate", { url }, WEB_AUTOMATION_INPUT_IDS.navigationRequested, "Navigate")
      : null;
  }
  if (eventType === WEB_AUTOMATION_EVENTS.elementClicked) {
    return selector ? candidate("web.dom.click", { selector }, WEB_AUTOMATION_INPUT_IDS.elementClicked, "Click") : null;
  }
  if (eventType === WEB_AUTOMATION_EVENTS.elementInputChanged || eventType === WEB_AUTOMATION_EVENTS.elementChanged) {
    if (!selector) return null;
    if (readString(readObject(payload.element)?.tagName) === "select") {
      return candidate("web.dom.select", { selector, value: inputValue ?? "" }, WEB_AUTOMATION_INPUT_IDS.optionSelected, "Select option");
    }
    return inputValue === ""
      ? candidate("web.dom.clear", { selector }, WEB_AUTOMATION_INPUT_IDS.fieldCleared, "Clear field")
      : candidate("web.dom.type", { selector, text: inputValue ?? "" }, WEB_AUTOMATION_INPUT_IDS.textEntered, "Enter text");
  }
  if (eventType === WEB_AUTOMATION_EVENTS.keyboardPressed) {
    return key ? candidate("web.dom.keypress", compact({ selector, key }), WEB_AUTOMATION_INPUT_IDS.keyPressed, "Press key") : null;
  }
  if (eventType === WEB_AUTOMATION_EVENTS.mouseWheel || eventType === WEB_AUTOMATION_EVENTS.scrollChanged) {
    const scroll = readObject(payload.scroll);
    const x = readNumber(scroll?.x);
    const y = readNumber(scroll?.y);
    return x !== undefined || y !== undefined
      ? candidate("web.dom.scroll", compact({ x, y }), WEB_AUTOMATION_INPUT_IDS.pageScrolled, "Scroll")
      : null;
  }
  return null;
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

function readSelector(value: unknown): string | undefined {
  return readString(readObject(value)?.selector);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export default registerFluxIQHost;
