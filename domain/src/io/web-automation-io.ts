import {
  defineDomainIo,
  defineInput,
  defineOutput,
  type DomainIoRegistration,
  type FluxIQ,
  type ClientGatewayEvent,
  type IoEnvelope,
  type OutputDispatchRequest,
  type OutputDispatchResult
} from "fluxiq";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../constants";
import { WEB_AUTOMATION_ACTION_TYPES, type WebAutomationActionType } from "../actions/types";
import {
  WEB_AUTOMATION_INPUT_IDS,
  actionInputDefinitions,
  stateInputDefinitions,
  type WebAutomationRecordedInputPayload
} from "./input-model";
import { webAutomationManifestInputs, webAutomationManifestOutputs } from "./manifest-definitions";

export * from "./input-model";

export { webAutomationManifestInputs, webAutomationManifestOutputs } from "./manifest-definitions";

export function createWebAutomationDomainIo(fluxiq: FluxIQ): DomainIoRegistration {
  const liveInputs = new GatewayInputHub(fluxiq);
  return defineDomainIo({
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    inputs: [
      ...stateInputDefinitions.map((definition) => defineInput({
        definition,
        mode: "stream" as const,
        subscribe: (handler) => liveInputs.subscribe(definition.id, handler)
      })),
      ...actionInputDefinitions.map(([id, title, outputId]) => defineInput<WebAutomationRecordedInputPayload>({
        definition: { id, title, role: "action", outputId },
        mode: "stream",
        subscribe: (handler) => liveInputs.subscribe(id, handler),
        outputBinding: { outputId, toPayload: (event) => outputPayload(outputId, event) }
      }))
    ],
    outputs: WEB_AUTOMATION_ACTION_TYPES.map((outputId) => defineOutput({
      definition: webAutomationManifestOutputs.find((output) => output.id === outputId)!,
      mode: "request",
      dispatch: (request) => dispatchWebAutomationOutput(fluxiq, request)
    }))
  });
}

/**
 * Mirrors the paired extension's declared input messages into input adapters.
 * The gateway bridge records the same messages; this source is for runtime
 * subscribers that need confirmation after an output has dispatched.
 */
class GatewayInputHub {
  private readonly listeners = new Map<string, Set<(event: IoEnvelope<JsonObject>) => void>>();

  constructor(fluxiq: FluxIQ) {
    fluxiq.programs.clientGateway.onEvent((event) => this.accept(event));
  }

  subscribe<TPayload extends JsonObject>(inputId: string, handler: (event: IoEnvelope<TPayload>) => void): () => void {
    const handlers = this.listeners.get(inputId) ?? new Set<(event: IoEnvelope<JsonObject>) => void>();
    handlers.add(handler as (event: IoEnvelope<JsonObject>) => void);
    this.listeners.set(inputId, handlers);
    return () => {
      handlers.delete(handler as (event: IoEnvelope<JsonObject>) => void);
      if (!handlers.size) this.listeners.delete(inputId);
    };
  }

  private accept(event: ClientGatewayEvent): void {
    if (event.type !== "client.recording_event" && event.type !== "client.state_update") return;
    const messagePayload = event.message.payload as JsonObject;
    const metadata = jsonObject(messagePayload.metadata);
    if (stringValue(metadata?.domainId) !== WEB_AUTOMATION_DOMAIN_ID) return;
    const inputId = stringValue(metadata?.inputId);
    if (!inputId) return;
    const payload = event.type === "client.recording_event"
      ? (jsonObject(messagePayload.payload) ?? {})
      : (jsonObject(messagePayload.state) ?? messagePayload);
    const envelope: IoEnvelope<JsonObject> = {
      id: event.message.id,
      domainId: WEB_AUTOMATION_DOMAIN_ID,
      ioId: inputId,
      sequence: typeof payload.sequence === "number" ? payload.sequence : 0,
      timestampMs: event.message.timestamp ?? Date.now(),
      payload,
      metadata: { sessionId: event.session.sessionId, clientId: event.session.clientId, ...metadata }
    };
    for (const handler of this.listeners.get(inputId) ?? []) handler(envelope);
  }
}

function outputPayload(outputId: WebAutomationActionType, event: IoEnvelope<WebAutomationRecordedInputPayload>): JsonObject {
  const payload = event.payload;
  const selector = stringValue(payload.element?.selector);
  if (outputId === "web.browser.navigate") return { url: payload.url };
  if (outputId === "web.dom.click") return compact({ selector });
  if (outputId === "web.dom.type") return compact({ selector, text: payload.inputValue ?? "" });
  if (outputId === "web.dom.clear") return compact({ selector });
  if (outputId === "web.dom.select") return compact({ selector, value: payload.inputValue ?? "" });
  if (outputId === "web.dom.keypress") return compact({ selector, key: payload.key ?? "" });
  if (outputId === "web.dom.scroll") return compact({ x: numberValue(payload.scroll?.x), y: numberValue(payload.scroll?.y) });
  return {};
}

async function dispatchWebAutomationOutput(
  fluxiq: FluxIQ,
  request: OutputDispatchRequest<JsonObject>
): Promise<OutputDispatchResult<JsonObject>> {
  const sessionId = targetSessionId(fluxiq, request.metadata);
  if (!sessionId) return { ok: false, outputId: request.outputId, error: "A single paired web-automation client must be selected before dispatching an output." };
  try {
    const target = targetFromPayload(request.payload);
    const command = target ? {
      actionType: request.outputId,
      parameters: request.payload,
      target
    } : {
      actionType: request.outputId,
      parameters: request.payload
    };
    const result = await fluxiq.programs.automationStudioClientGateway.executeAction(sessionId, command);
    return {
      ok: result.status === "succeeded",
      outputId: request.outputId,
      payload: compact({ status: result.status, message: result.message, result: result.payload }),
      ...(result.error ? { error: result.error } : {})
    };
  } catch (error) {
    return { ok: false, outputId: request.outputId, error: error instanceof Error ? error.message : "Web automation output dispatch failed." };
  }
}

function targetSessionId(fluxiq: FluxIQ, metadata: JsonObject | undefined): string | undefined {
  const requested = stringValue(metadata?.sessionId);
  const eligible = fluxiq.programs.clientGateway.snapshot().sessions.filter((session) =>
    session.status === "connected" &&
    session.clientType === "extension" &&
    session.metadata?.domainId === WEB_AUTOMATION_DOMAIN_ID &&
    session.capabilities.some((capability) => capability.id === "web.actions")
  );
  if (requested) return eligible.some((session) => session.sessionId === requested) ? requested : undefined;
  return eligible.length === 1 ? eligible[0]?.sessionId : undefined;
}

function targetFromPayload(payload: JsonObject): JsonObject | undefined {
  const selector = stringValue(payload.selector);
  return selector ? { selector } : undefined;
}

function compact(value: Record<string, unknown>): JsonObject {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as JsonObject;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function jsonObject(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}
