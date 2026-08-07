import { FluxIQ, type FluxIQOptions } from "fluxiq";
import { webAutomationDomain } from "./manifest";
import { createWebAutomationDomainIo } from "./io/web-automation-io";
import { webAutomationRecordingDomain } from "./recording/domain";

export function registerWebAutomationDomain(fluxiq: FluxIQ): FluxIQ {
  if (!fluxiq.domains.maybeGet(webAutomationDomain.manifest.id)) {
    fluxiq.registerDomain(webAutomationDomain);
  }
  if (!fluxiq.ioSnapshot(webAutomationDomain.manifest.id).inputs.length) {
    fluxiq.registerDomainIo(createWebAutomationDomainIo(fluxiq));
  }
  if (!fluxiq.programs.automationStudio.listRecordingDomains().some((domain) => domain.domainId === webAutomationRecordingDomain.domainId)) {
    fluxiq.programs.automationStudio.registerRecordingDomain(webAutomationRecordingDomain);
  }
  return fluxiq;
}

export function createWebAutomationFluxIQ(options: FluxIQOptions = {}): FluxIQ {
  return registerWebAutomationDomain(FluxIQ.create({
    ...options,
    domains: [...(options.domains ?? []), webAutomationDomain]
  }));
}
