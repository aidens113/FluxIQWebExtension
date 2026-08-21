import type { FluxIQRuntimeAdapter } from "fluxiq/runtime";
import type { FluxIQ } from "fluxiq";
import { createWebAutomationRuntimeAdapter } from "./adapter";

export function registerWebAutomationRuntime(fluxiq: FluxIQ): FluxIQ {
  registerWebAutomationRuntimeAdapter(fluxiq);
  bindAutomationStudioRuntimeService(fluxiq);
  return fluxiq;
}

export function registerWebAutomationRuntimeAdapter(fluxiq: FluxIQ): FluxIQRuntimeAdapter {
  const existing = fluxiq.runtime.adaptersList().find((adapter) => adapter.adapterId === "web-automation.gateway");
  if (existing) return existing;
  const adapter = createWebAutomationRuntimeAdapter({ fluxiq });
  fluxiq.runtime.registerAdapter(adapter);
  return adapter;
}

export function bindAutomationStudioRuntimeService(fluxiq: FluxIQ): void {
  fluxiq.programs.automationStudio.bindRuntimeService(fluxiq.runtime);
}

export async function validateWebAutomationRuntime(fluxiq: FluxIQ): Promise<{ ok: boolean; issues: string[] }> {
  const capabilities = await fluxiq.runtime.capabilities();
  const hasWebActions = capabilities.some((capability) =>
    capability.id === "web.actions" &&
    capability.outputIds?.includes("web.dom.click")
  );
  return hasWebActions
    ? { ok: true, issues: [] }
    : { ok: false, issues: ["web-automation.runtime.missing_actions"] };
}
