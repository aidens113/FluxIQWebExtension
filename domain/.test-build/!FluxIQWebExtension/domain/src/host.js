import { FluxIQ } from "fluxiq";
import { webAutomationDomain } from "./manifest";
import { webAutomationRecordingDomain } from "./recording/domain";
export function registerWebAutomationDomain(fluxiq) {
    if (!fluxiq.domains.maybeGet(webAutomationDomain.manifest.id)) {
        fluxiq.registerDomain(webAutomationDomain);
    }
    if (!fluxiq.programs.automationStudio.listRecordingDomains().some((domain) => domain.domainId === webAutomationRecordingDomain.domainId)) {
        fluxiq.programs.automationStudio.registerRecordingDomain(webAutomationRecordingDomain);
    }
    return fluxiq;
}
export function createWebAutomationFluxIQ(options = {}) {
    return registerWebAutomationDomain(FluxIQ.create({
        ...options,
        domains: [...(options.domains ?? []), webAutomationDomain]
    }));
}
