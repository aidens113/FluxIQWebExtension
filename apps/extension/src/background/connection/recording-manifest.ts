// The manifest a recording opens with: the environment the extension runs in,
// the evidence sources it will produce, and the action channel it accepts
// commands on. Every id here is wire-visible and keyed by the client id.

import { WEB_AUTOMATION_DOMAIN_ID } from "@fluxiq-web-extension/domain/client";
import { browserDescriptor } from "../../shared/browser";
import { browserExtensionCapabilities, type JsonObject } from "../../shared/protocol";
import { actionTypesFromCapabilities } from "./browser-state";
import { compactObject } from "./value-readers";

export function eventSourceId(clientId: string): string {
  return `client.${clientId}.events`;
}

export function observationSourceId(clientId: string): string {
  return `client.${clientId}.observations`;
}

export function stateSourceId(clientId: string): string {
  return `client.${clientId}.state`;
}

export function tabSourceId(tabId: number, frameId?: number): string {
  return `tab:${tabId}${frameId === undefined ? "" : `:frame:${frameId}`}`;
}

export function recordingEnvironment(clientId: string, activeTabUrl: string | undefined): JsonObject {
  return compactObject({
    id: `client.${clientId}.browser`,
    label: "FluxIQ Browser Extension",
    kind: "browser_extension",
    domainId: WEB_AUTOMATION_DOMAIN_ID,
    capabilities: browserExtensionCapabilities.map((capability) => capability.id),
    metadata: compactObject({
      browser: browserDescriptor() as unknown as JsonObject,
      activeTabUrl
    }) as JsonObject
  }) as JsonObject;
}

export function recordingSources(clientId: string): JsonObject[] {
  return [
    { id: eventSourceId(clientId), label: "Browser events", kind: "event", schemaId: WEB_AUTOMATION_DOMAIN_ID, metadata: { clientId } },
    { id: observationSourceId(clientId), label: "Browser observations", kind: "observation", schemaId: WEB_AUTOMATION_DOMAIN_ID, metadata: { clientId } },
    { id: stateSourceId(clientId), label: "Browser state", kind: "state", schemaId: WEB_AUTOMATION_DOMAIN_ID, metadata: { clientId } }
  ] as JsonObject[];
}

export function recordingActionChannels(clientId: string): JsonObject[] {
  return [{
    id: `client.${clientId}.actions`,
    label: "Browser action channel",
    actionTypes: actionTypesFromCapabilities(browserExtensionCapabilities),
    capabilities: browserExtensionCapabilities.map((capability) => capability.id),
    metadata: { clientId }
  }] as JsonObject[];
}
