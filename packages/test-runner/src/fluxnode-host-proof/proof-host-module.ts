import { pathToFileURL } from "node:url";
import type { FluxIQ } from "fluxiq";
import { AutomationStudioHostLeaseScope, createAutomationStudioAnthropicProvider } from "fluxiq/automation";
import { scriptedModelKey, SCRIPTED_MODEL_ORIGIN_ENV } from "../attempt-lane/scripted-model/index.js";
import { sendHostProofEvent } from "./events.js";
import { hostProofModelFetch } from "./model-fetch.js";

const hostPath = process.env.FLUXIQ_LAB_HOST_MODULE;
const origin = process.env[SCRIPTED_MODEL_ORIGIN_ENV];
if (!hostPath || !origin || new URL(origin).hostname !== "127.0.0.1") throw new Error("A provider-free host proof requires its built domain module and loopback scripted model.");
const base = await import(pathToFileURL(hostPath).href) as { registerFluxIQHost(fluxiq: FluxIQ): FluxIQ };

/** Only the execution-provider port is replaced; the complete domain/runtime remains the product's. */
export function registerFluxIQHost(fluxiq: FluxIQ): FluxIQ {
  const registered = base.registerFluxIQHost(fluxiq);
  const provider = createAutomationStudioAnthropicProvider({ secretReference: { kind: "secret_reference", id: "secret:scripted-host-proof" },
    resolveSecret: async () => scriptedModelKey(), fetchImpl: hostProofModelFetch(fetch, origin!, () => AutomationStudioHostLeaseScope.current()?.holder.briefId) });
  registered.programs.automationStudio.bindLlmExecutionProvider(async () => ({ provider }));
  registered.programs.clientGateway.onEvent((event) => {
    if (event.type === "session.ready") sendHostProofEvent({ type: "proof.session", hostId: event.session.managedHostId, sessionId: event.session.sessionId });
    if (event.type === "client.action_result") {
      const binding = registered.programs.clientGateway.managedHosts.currentRun(event.session.sessionId);
      sendHostProofEvent({ type: "proof.action", sessionId: event.session.sessionId, hostId: event.session.managedHostId, runId: binding?.runId,
        failureCode: event.message.payload.failure?.code });
    }
  });
  return registered;
}
