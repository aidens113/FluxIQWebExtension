import type { RecordingDomainDefinition } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_DOMAIN_ID, WEB_AUTOMATION_SCHEMA_VERSION } from "../constants";
import { webAutomationActionDefinitions } from "../actions/schemas";
import { webAutomationRecordingEvents } from "./events";
import { WEB_AUTOMATION_VIEWPORT_VISUALIZER_ID } from "./web-state";

export const webAutomationRecordingDomain: RecordingDomainDefinition = {
  domainId: WEB_AUTOMATION_DOMAIN_ID,
  label: "Web Automation",
  schemaVersion: WEB_AUTOMATION_SCHEMA_VERSION,
  description: "Validated recording events, state updates, and observations for browser-based web automation.",
  events: webAutomationRecordingEvents,
  statePaths: [
    { namespace: "web", path: "page.url", type: "string", elementKind: "url", label: "Page URL", volatility: "normal", stableAcrossSessions: false, metadata: { presentation: { group: "Page", icon: "link", visualKind: "text" } } },
    { namespace: "web", path: "page.title", type: "string", elementKind: "text", label: "Page title", volatility: "normal", metadata: { presentation: { group: "Page", icon: "type", visualKind: "text" } } },
    { namespace: "web", path: "page.selectedText", type: "string", elementKind: "text", label: "Selected text", volatility: "rapid", metadata: { presentation: { group: "Page", icon: "text-select", visualKind: "text" } } },
    { namespace: "web", path: "viewport.bounds", type: "rectangle", elementKind: "bounds", label: "Viewport bounds", volatility: "normal", metadata: { presentation: { group: "Viewport", icon: "scan", visualKind: "bounds", metadata: { rendererId: WEB_AUTOMATION_VIEWPORT_VISUALIZER_ID } } } },
    { namespace: "web", path: "scroll.position", type: "point", elementKind: "position", label: "Scroll position", volatility: "rapid" },
    { namespace: "web", path: "focus.target", type: "json", elementKind: "json", label: "Focused target", volatility: "rapid" },
    { namespace: "web", path: "elements.count", type: "integer", elementKind: "count", label: "Captured element count", volatility: "normal" },
    { namespace: "web", path: "elements.*", type: "json", elementKind: "json", label: "Element", stableAcrossSessions: true, volatility: "normal", metadata: { presentation: { group: "Elements", icon: "scan-search", visualKind: "bounds", metadata: { rendererId: WEB_AUTOMATION_VIEWPORT_VISUALIZER_ID } } } },
    { namespace: "web", path: "elements.*.selector", type: "string", elementKind: "selector", label: "Element selector", stableAcrossSessions: true, volatility: "slow", metadata: { presentation: { group: "Elements", icon: "locate-fixed", visualKind: "text" } } },
    { namespace: "web", path: "elements.*.stableId", type: "string", elementKind: "static_id", label: "Element stable ID", stableAcrossSessions: true, volatility: "slow", metadata: { presentation: { group: "Elements", icon: "fingerprint", visualKind: "badge" } } },
    { namespace: "web", path: "elements.*.tagName", type: "string", elementKind: "static_id", label: "Element tag", stableAcrossSessions: true, volatility: "slow", metadata: { presentation: { group: "Elements", icon: "code", visualKind: "badge" } } },
    { namespace: "web", path: "elements.*.text", type: "string", elementKind: "text", label: "Element text", volatility: "normal", metadata: { presentation: { group: "Elements", icon: "type", visualKind: "text" } } },
    { namespace: "web", path: "elements.*.label", type: "string", elementKind: "label", label: "Element label", volatility: "normal", metadata: { presentation: { group: "Elements", icon: "tag", visualKind: "text" } } },
    { namespace: "web", path: "elements.*.value", type: "string", elementKind: "text", label: "Element value", volatility: "normal", sensitive: true, metadata: { presentation: { group: "Elements", icon: "text-cursor-input", visualKind: "text", sensitive: true } } },
    { namespace: "web", path: "elements.*.href", type: "string", elementKind: "url", label: "Element link URL", volatility: "slow", metadata: { presentation: { group: "Elements", icon: "link", visualKind: "text" } } },
    { namespace: "web", path: "elements.*.visible", type: "boolean", elementKind: "visibility", label: "Element visible", volatility: "normal", metadata: { presentation: { group: "Elements", icon: "eye", visualKind: "badge" } } },
    { namespace: "web", path: "elements.*.enabled", type: "boolean", elementKind: "enabled", label: "Element enabled", volatility: "normal", metadata: { presentation: { group: "Elements", icon: "badge-check", visualKind: "badge" } } },
    { namespace: "web", path: "elements.*.bounds", type: "rectangle", elementKind: "bounds", label: "Element bounds", volatility: "normal", metadata: { presentation: { group: "Elements", icon: "scan", visualKind: "bounds", metadata: { rendererId: WEB_AUTOMATION_VIEWPORT_VISUALIZER_ID } } } },
    { namespace: "web", path: "forms.*", type: "string", elementKind: "text", label: "Form field value", volatility: "normal", sensitive: true },
    { namespace: "web", path: "runtime.lastActionResult", type: "json", elementKind: "json", label: "Last action result", volatility: "normal" },
    { namespace: "web", path: "runtime.lastActionVisualTarget", type: "json", elementKind: "json", label: "Last action visual target", volatility: "normal", metadata: { presentation: { group: "Runtime", icon: "scan-search", visualKind: "bounds" } } },
    { namespace: "web", path: "runtime.lastError", type: "json", elementKind: "json", label: "Last client error", volatility: "normal" },
    { namespace: "web", path: "browser.activeTabId", type: "integer", elementKind: "internal_id", label: "Active tab ID", volatility: "normal" },
    { namespace: "web", path: "browser.tabCount", type: "integer", elementKind: "count", label: "Browser tab count", volatility: "normal" },
    { namespace: "web", path: "recording.active", type: "boolean", elementKind: "status", label: "Recording active", volatility: "normal" }
  ],
  metadata: {
    actionDefinitions: webAutomationActionDefinitions
  }
};
