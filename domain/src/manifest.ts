import type { DomainRegistration } from "fluxiq";
import { WEB_AUTOMATION_DOMAIN_ID } from "./constants";
import { webAutomationActionDefinitions } from "./actions/schemas";
import { webAutomationManifestInputs, webAutomationManifestOutputs } from "./io/manifest-definitions";

export const webAutomationDomain: DomainRegistration = {
  manifest: {
    id: WEB_AUTOMATION_DOMAIN_ID,
    title: "Web Automation",
    category: "automation",
    description: "Record, inspect, and replay browser-based web workflows through generic FluxIQ clients.",
    icon: "mouse-pointer-click",
    status: "preview",
    capabilities: ["recording", "state", "snapshot", "action-execution"],
    inputs: webAutomationManifestInputs,
    outputs: webAutomationManifestOutputs,
    metadata: {
      actionDefinitions: webAutomationActionDefinitions
    }
  }
};
