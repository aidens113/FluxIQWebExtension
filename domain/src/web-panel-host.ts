import { webAutomationDomain } from "./manifest";
import { webAutomationRecordingDomain } from "./recording/domain";

type FluxIQHostRuntime = {
  domains: {
    maybeGet(id: string): unknown;
  };
  registerDomain(domain: typeof webAutomationDomain): unknown;
  programs: {
    automationStudio: {
      listRecordingDomains(): Array<{ domainId: string }>;
      registerRecordingDomain(domain: typeof webAutomationRecordingDomain): unknown;
    };
  };
};

export function registerFluxIQHost(fluxiq: FluxIQHostRuntime): FluxIQHostRuntime {
  if (!fluxiq.domains.maybeGet(webAutomationDomain.manifest.id)) {
    fluxiq.registerDomain(webAutomationDomain);
  }

  const hasRecordingDomain = fluxiq.programs.automationStudio
    .listRecordingDomains()
    .some((domain) => domain.domainId === webAutomationRecordingDomain.domainId);

  if (!hasRecordingDomain) {
    fluxiq.programs.automationStudio.registerRecordingDomain(webAutomationRecordingDomain);
  }

  return fluxiq;
}

export default registerFluxIQHost;
