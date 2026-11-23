import path from "node:path";
import type { FluxIQ } from "fluxiq";
import { createAutomationStudioAnthropicProvider } from "fluxiq/automation";
import { registerFluxIQHost as registerDomainHost } from "@fluxiq-web-extension/domain/node";
import { bindRecordedCaptureEntry } from "./entry-binding.js";
import { recordedCaptureTransport } from "./transport.js";

/** Provider-free fixture host: native parsing receives literal malformed bytes; no network port exists. */
export function registerFluxIQHost(fluxiq: FluxIQ): FluxIQ {
  const root = process.env.FLUXIQ_ROOT;
  if (!root || !path.resolve(root).split(path.sep).includes("test-runs")) throw new Error("recorded_capture_host_requires_isolated_root");
  const registered = registerDomainHost(fluxiq);
  const service = registered.programs.automationStudio;
  const generate = service.generateFlowBootstrapAdaptation.bind(service);
  let active: typeof fetch | undefined;
  service.generateFlowBootstrapAdaptation = async (request) => {
    if (active) throw new Error("recorded_capture_concurrent_entry_refused");
    const bound = await bindRecordedCaptureEntry(root, request);
    const { projectId, flowId } = bound.entry.request;
    active = recordedCaptureTransport({ wireFile: bound.wireFile, attach: bound.attach, cancel: () => { service.buildCancellation.cancel(projectId, flowId); } });
    // The service runs exactly the bound entry, which is what a replay enters too.
    try { return await generate(bound.entry.request); } finally { active = undefined; }
  };
  const provider = createAutomationStudioAnthropicProvider({ model: "claude-haiku-5-5", secretReference: { kind: "secret_reference", id: "secret:recorded-capture-fixture" }, resolveSecret: async () => "recorded-fixture-only", fetchImpl: async (_url, init) => {
    const transport = active;
    if (!transport) throw new Error("recorded_capture_public_entry_missing");
    return transport(_url, init);
  } });
  service.bindLlmExecutionProvider(async () => ({ provider }));
  return registered;
}
