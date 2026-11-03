import { FluxIQ, type FluxIQOptions } from "fluxiq";
import { AutomationStudioNativeNodeRuntime } from "fluxiq/automation-studio";
import { webAutomationDomain } from "./manifest";
import { createWebAutomationDomainIo } from "./io/web-automation-io";
import { createWebAutomationOutputNodeImplementationBundle, createWebAutomationOutputNodeManifest, WEB_AUTOMATION_RUNTIME_CAPABILITIES, WEB_AUTOMATION_RUNTIME_PERMISSIONS } from "./output-nodes";
import { webAutomationRecordingDomain } from "./recording/domain";
import { registerWebAutomationRuntime } from "./runtime/service";
import { webAutomationRequestPolicies, type WebAutomationRequestPolicyInput } from "./requests";

export function registerWebAutomationDomain(fluxiq: FluxIQ, requestPolicy?: WebAutomationRequestPolicyInput): FluxIQ {
  webAutomationRequestPolicies.register(fluxiq, requestPolicy);
  if (!fluxiq.domains.maybeGet(webAutomationDomain.manifest.id)) {
    fluxiq.registerDomain(webAutomationDomain);
  }
  if (!fluxiq.ioSnapshot(webAutomationDomain.manifest.id).inputs.length) {
    fluxiq.registerDomainIo(createWebAutomationDomainIo(fluxiq));
  }
  if (!fluxiq.programs.automationStudio.listRecordingDomains().some((domain) => domain.domainId === webAutomationRecordingDomain.domainId)) {
    fluxiq.programs.automationStudio.registerRecordingDomain(webAutomationRecordingDomain);
  }
  registerWebAutomationRuntime(fluxiq);
  // Core reads no target: an element output needs this domain's reading of one, so a host with the outputs has the bundle too.
  if (!fluxiq.programs.automationStudio.nativeRuntimeSummary().bound) {
    fluxiq.programs.automationStudio.bindNativeNodeRuntime(new AutomationStudioNativeNodeRuntime({ permissions: WEB_AUTOMATION_RUNTIME_PERMISSIONS, runtimeCapabilities: WEB_AUTOMATION_RUNTIME_CAPABILITIES }).register(createWebAutomationOutputNodeManifest(), createWebAutomationOutputNodeImplementationBundle()));
  }
  return fluxiq;
}

export function createWebAutomationFluxIQ(options: FluxIQOptions = {}, requestPolicy?: WebAutomationRequestPolicyInput): FluxIQ {
  const policy = webAutomationRequestPolicies.normalize(requestPolicy);
  return registerWebAutomationDomain(FluxIQ.create({
    ...options,
    domains: [...(options.domains ?? []), webAutomationDomain]
  }), policy);
}
