import type { ClientGatewayEvent, FluxIQ, IoEnvelope } from "fluxiq";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID } from "../constants";

/**
 * Mirrors paired extension input messages into streamable domain IO adapters.
 * Runtime output confirmation waits on these envelopes after dispatch.
 */
export class GatewayInputHub {
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
    const messagePayload = jsonObject(event.message.payload);
    if (!messagePayload) return;
    const metadata = jsonObject(messagePayload.metadata);
    // A recording event names its domain at the top level, which is where
    // Core's gateway bridge reads it; runtime confirmations and state updates
    // carry it in metadata. The top-level field wins, as it does in Core.
    const domainId = stringValue(messagePayload.domainId) ?? stringValue(metadata?.domainId);
    if (domainId !== WEB_AUTOMATION_DOMAIN_ID) return;
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

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function jsonObject(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}
