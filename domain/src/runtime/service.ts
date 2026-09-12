import type { FluxIQRuntimeAdapter } from "fluxiq/runtime";
import type { FluxIQ } from "fluxiq";
import { createWebAutomationRuntimeAdapter } from "./adapter";
import { bindWebAutomationHostRuntime } from "./host-runtime";
import { bindWebAutomationLlmEvidenceRuntime } from "./llm-evidence";

export function registerWebAutomationRuntime(fluxiq: FluxIQ): FluxIQ {
  registerWebAutomationRuntimeAdapter(fluxiq);
  bindAutomationStudioRuntimeService(fluxiq);
  bindWebAutomationLlmEvidenceRuntime(fluxiq);
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
  // The host runtime rides the same binding step: it is what gives a web
  // attempt its `stateRefs`, and it carries the expectation evaluator Core
  // reads off the same boundary object.
  bindWebAutomationHostRuntime(fluxiq);
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
