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
    { namespace: "web", path: "elements.count", type: "integer", elementKind: "count", label: "Elements on the page", volatility: "normal" },
    { namespace: "web", path: "elements.captured", type: "integer", elementKind: "count", label: "Elements captured", volatility: "normal" },
    { namespace: "web", path: "elements.truncated", type: "boolean", elementKind: "status", label: "Element capture truncated", volatility: "normal" },
    // One captured element is one JSON value, and that value is the contract.
    // `web-state.ts` writes `elements.<id>` as a single `json` blob and writes
    // nothing under it, so the per-field paths this list used to declare —
    // selector, stableId, tagName, text, label, value, href, visible, enabled,
    // bounds — resolved to nothing on every snapshot. Declaring them offered
    // Flow authors and the graph generator eleven bindings where only one
    // exists, and each of the ten always read empty. Consumers read the blob:
    // the packet in `runtime/llm-evidence.ts`, the fingerprint in
    // `output-nodes/targets.ts`, and the visualizer through
    // `metadata.presentation`. Re-declare a field only when a producer writes
    // it as its own state value.
    { namespace: "web", path: "elements.*", type: "json", elementKind: "json", label: "Element", stableAcrossSessions: true, volatility: "normal", metadata: { presentation: { group: "Elements", icon: "scan-search", visualKind: "bounds", metadata: { rendererId: WEB_AUTOMATION_VIEWPORT_VISUALIZER_ID } } } },
    { namespace: "web", path: "forms.*", type: "string", elementKind: "text", label: "Form field value", volatility: "normal", sensitive: true },
    { namespace: "web", path: "runtime.lastActionResult", type: "json", elementKind: "json", label: "Last action result", volatility: "normal" },
    { namespace: "web", path: "runtime.lastActionVisualTarget", type: "json", elementKind: "json", label: "Last action visual target", volatility: "normal", metadata: { presentation: { group: "Runtime", icon: "scan-search", visualKind: "bounds" } } },
    { namespace: "web", path: "runtime.lastError", type: "json", elementKind: "json", label: "Last client error", volatility: "normal" },
    { namespace: "web", path: "browser.activeTabId", type: "integer", elementKind: "internal_id", label: "Active tab ID", volatility: "normal" },
    { namespace: "web", path: "browser.tabCount", type: "integer", elementKind: "count", label: "Browser tab count", volatility: "normal" },
    // The mirror of the removals above: `web-state.ts` writes this one and the
    // list did not declare it, so a produced value had no declaration.
    { namespace: "web", path: "browser.permissions", type: "json", elementKind: "collection", label: "Granted browser permissions", volatility: "slow" },
    { namespace: "web", path: "recording.active", type: "boolean", elementKind: "status", label: "Recording active", volatility: "normal" }
  ],
  metadata: {
    actionDefinitions: webAutomationActionDefinitions
  }
};
