import type { RecordingDomainDefinition } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_DOMAIN_ID, WEB_AUTOMATION_SCHEMA_VERSION } from "../constants";
import { webAutomationActionDefinitions } from "../actions/schemas";
import { webAutomationRecordingEvents } from "./events";

export const webAutomationRecordingDomain: RecordingDomainDefinition = {
  domainId: WEB_AUTOMATION_DOMAIN_ID,
  label: "Web Automation",
  schemaVersion: WEB_AUTOMATION_SCHEMA_VERSION,
  description: "Validated recording events, state updates, and observations for browser-based web automation.",
  events: webAutomationRecordingEvents,
  statePaths: [
    { namespace: "web", path: "page.url", type: "string", label: "Page URL", volatility: "normal" },
    { namespace: "web", path: "page.title", type: "string", label: "Page title", volatility: "normal" },
    { namespace: "web", path: "page.viewport", type: "json", label: "Viewport", volatility: "normal" },
    { namespace: "web", path: "page.lastInteraction", type: "json", label: "Last interaction", volatility: "rapid" },
    { namespace: "web", path: "page.scroll", type: "json", label: "Scroll", volatility: "rapid" },
    { namespace: "web", path: "page.latestSnapshot", type: "json", label: "Latest snapshot", volatility: "normal" },
    { namespace: "web", path: "runtime.lastActionResult", type: "json", label: "Last action result", volatility: "normal" },
    { namespace: "web", path: "runtime.lastError", type: "json", label: "Last client error", volatility: "normal" }
  ],
  metadata: {
    actionDefinitions: webAutomationActionDefinitions
  }
};
