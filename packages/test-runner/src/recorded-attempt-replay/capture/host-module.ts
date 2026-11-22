import { readFile } from "node:fs/promises";
import path from "node:path";
import type { FluxIQ } from "fluxiq";
import { createAutomationStudioAnthropicProvider } from "fluxiq/automation";
import { registerFluxIQHost as registerDomainHost } from "@fluxiq-web-extension/domain/node";
import { recordedCaptureAttachment } from "./attachment.js";
import { recordedRequestDigest } from "../request-digest.js";
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
    const configuration = JSON.parse(await readFile(path.join(root, ".recorded-capture.json"), "utf8"));
    const entry = { request, chat: null };
    if (recordedRequestDigest(JSON.stringify(entry)) !== configuration.receipt.entryDigest) throw new Error("recorded_capture_actual_entry_changed");
    const relative = path.relative(path.dirname(root), path.resolve(configuration.wireFile));
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("recorded_capture_wire_scope_refused");
    const attach = recordedCaptureAttachment(configuration.receipt, Buffer.from(configuration.receiptBase64, "base64"));
    active = recordedCaptureTransport({ wireFile: configuration.wireFile, attach: () => attach(entry), cancel: () => { service.buildCancellation.cancel(request.projectId, request.flowId); } });
    try { return await generate(request); } finally { active = undefined; }
  };
  const provider = createAutomationStudioAnthropicProvider({ model: "claude-haiku-5-5", secretReference: { kind: "secret_reference", id: "secret:recorded-capture-fixture" }, resolveSecret: async () => "recorded-fixture-only", fetchImpl: async (_url, init) => {
    const transport = active;
    if (!transport) throw new Error("recorded_capture_public_entry_missing");
    return transport(_url, init);
  } });
  service.bindLlmExecutionProvider(async () => ({ provider }));
  return registered;
}
