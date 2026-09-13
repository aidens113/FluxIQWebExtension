import type { FluxIQ } from "fluxiq";
import { AutomationStudioNativeNodeRuntime, type AutomationStudioRecordingMapperCandidate, type AutomationStudioRecordingMapperContext, type AutomationStudioRecordingMapperObservation } from "fluxiq/automation-studio";
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
import { webAutomationLateTargetWait } from "./recording/proposals";
import { WEB_AUTOMATION_STATE_NAMESPACE } from "./recording/state";
import { WEB_AUTOMATION_VIEWPORT_VISUALIZER_ID } from "./recording/web-state";
import { webAutomationOutputPayload } from "./web-panel/output-nodes";
import { webAutomationClickLandingExpectation } from "./runtime/expectation";
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
  "web.dom.scroll": "Scroll",
  "web.dom.upload": "Upload files",
  "web.browser.tab": "Browser tab"
};

/**
 * Recording -> Subflow mapper. It resolves each observation through the same
 * `webAutomationRecordedAction` the live gateway input path uses, so a
 * proposed node carries the parameters a live recording would have: the
 * selector together with the element fingerprint and visual target.
 *
 * A click also proposes where it landed as its `expectedState`, read off the
 * explained navigation among the entries Core shows the mapper after it
 * (`context.following`). The context is optional so a caller holding one
 * observation can still map it; without it a click claims nothing.
 *
 * A recorded DOM addition that no action maps from proposes a wait for the
 * next click's target, from the mutation's own call (`recording/proposals`).
 *
 * A click recorded through its action input arrives as Core's `action` entry.
 * When a landing in `following` names the event id Core stored on it, it gives
 * the candidate Core's fallback would propose for that entry, plus the claim.
 * Every other `action` entry maps to `null`, so Core's fallback stands for it.
 */
export function mapWebRecordingObservation(observation: AutomationStudioRecordingMapperObservation, context?: Pick<AutomationStudioRecordingMapperContext, "following">): AutomationStudioRecordingMapperCandidate | null {
  const step = recordedStep(observation);
  const action = webAutomationRecordedAction(step.eventType, step.payload, step.metadata);
  if (!action) return linkedClickEntry(observation, context?.following ?? []) ?? webAutomationLateTargetWait(step, (context?.following ?? []).map(recordedStep)) ?? null;
  const expectedState = action.outputId === "web.dom.click" ? webAutomationClickLandingExpectation(step, (context?.following ?? []).map(recordedStep)) : undefined;
  return candidate(action.outputId, action.parameters, action.inputId, CANDIDATE_LABELS[action.outputId] ?? action.outputId, expectedState);
}

/** An observation as the recorded event it carries: its event type, its own payload, and its metadata over the payload's. */
function recordedStep(observation: AutomationStudioRecordingMapperObservation): { eventType: string; timestamp: number; payload: JsonObject; metadata: JsonObject } {
  const payload = recordedEventPayload(observation);
  const metadata = { ...(readObject(payload.metadata) ?? {}), ...observation.metadata } as JsonObject;
  return { eventType: recordedEventType(observation), timestamp: observation.timestamp, payload, metadata };
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

function candidate(outputId: string, parameters: JsonObject, sourceInputId: string, label: string, expectedState?: JsonObject): AutomationStudioRecordingMapperCandidate {
  return { outputId, parameters: compact(parameters), sourceInputIds: [sourceInputId], expectedConfirmation: { inputId: sourceInputId, timeoutMs: 5_000 }, ...(expectedState === undefined ? {} : { expectedState }), confidence: 0.9, label };
}

/** The label Core's fallback gives a `web.dom.click` action entry, `readableTokenValue` of its output id. The Core proposal rows in `tests/domain.test.ts` hold the two equal. */
const FALLBACK_CLICK_LABEL = "Web Dom Click";

/**
 * A click's `action` entry whose landing names the event id Core stored on it,
 * as the candidate Core's fallback (`recordingActionEntryCandidate`) proposes for
 * that entry, read off the same fields: output, parameters, source input,
 * confirmation, confidence and label, with the landing claim added. Any other
 * `action` entry gives `undefined`, and so does one the fallback refuses
 * (`policyEligible: false`), so Core's fallback decides for it.
 */
function linkedClickEntry(observation: AutomationStudioRecordingMapperObservation, following: readonly AutomationStudioRecordingMapperObservation[]): AutomationStudioRecordingMapperCandidate | undefined {
  if (observation.type !== "action" || observation.metadata.policyEligible === false) return undefined;
  const entry = observation.payload;
  const outputId = nonBlankString(entry.outputId) ?? nonBlankString(entry.actionType);
  if (outputId !== "web.dom.click") return undefined;
  const expectedState = webAutomationClickLandingExpectation(recordedStep(observation), following.map(storedStep));
  if (expectedState === undefined) return undefined;
  const sourceInputId = nonBlankString(observation.metadata.inputId) ?? nonBlankString(entry.confirmationInputId);
  const confirmationInputId = readString(entry.confirmationInputId);
  const timeoutMs = entry.confirmationTimeoutMs;
  return {
    outputId,
    parameters: (readObject(entry.parameters) ?? {}) as JsonObject,
    ...(sourceInputId === undefined ? {} : { sourceInputIds: [sourceInputId] }),
    ...(confirmationInputId ? { expectedConfirmation: { inputId: confirmationInputId, timeoutMs: typeof timeoutMs === "number" ? timeoutMs : 5_000 } } : {}),
    expectedState,
    confidence: 0.95,
    label: FALLBACK_CLICK_LABEL
  };
}

/**
 * An entry after an `action` entry, read as Core hands it over. Core records a
 * domain event's own payload inside its `{ target?, payload }`, one level below
 * where `recordedStep` looks, so a landing's URL is read from there.
 */
function storedStep(observation: AutomationStudioRecordingMapperObservation): ReturnType<typeof recordedStep> {
  if (observation.type !== "domain_event") return recordedStep(observation);
  const payload = (readObject(readObject(observation.payload.payload)?.payload) ?? {}) as JsonObject;
  return { eventType: recordedEventType(observation), timestamp: observation.timestamp, payload, metadata: { ...(readObject(payload.metadata) ?? {}), ...observation.metadata } as JsonObject };
}

function nonBlankString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
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
