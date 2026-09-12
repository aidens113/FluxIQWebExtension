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
    // Three flags, because two caps can shorten the element list and each has
    // its own remedy. `elements.truncated` is the summary a consumer asks when
    // it only needs to know something is missing; the other two say which cap
    // bit, and so what to do about it. The full set of limits on the evidence
    // path is tabulated in `web-state/evidence/input.ts`.
    { namespace: "web", path: "elements.truncated", type: "boolean", elementKind: "status", label: "Element list incomplete", volatility: "normal" },
    { namespace: "web", path: "elements.captureTruncated", type: "boolean", elementKind: "status", label: "Browser capture dropped elements", volatility: "normal" },
    { namespace: "web", path: "elements.stateTruncated", type: "boolean", elementKind: "status", label: "State cap dropped elements", volatility: "normal" },
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
    // The page-level evidence, written by `web-state/evidence/project.ts`: what
    // the page *is* rather than what its elements are. Every path mirrors the
    // producer's own field path under one `evidence.` prefix, so the shape in
    // `apps/extension/src/content/evidence/types.ts` is the index to this list.
    //
    // These thirty were produced and undeclared for the whole of Phase 1.4, and
    // the ratchet in `tests/domain.test.ts` did not say so because its fixture
    // carried no evidence: nothing was produced under the prefix, so neither
    // "produced but undeclared" nor "declared but unproduced" had anything to
    // examine. The fixture now carries a full capture, which is what makes
    // every line below load-bearing -- delete one and that test fails.
    //
    // A collection is one `json` value of `{ count, truncated, items }`, never
    // a path per item, for the reason `project.ts` gives: state is rebuilt on
    // every recorded event and consumers read the blob.
    { namespace: "web", path: "evidence.elements.scanned", type: "integer", elementKind: "count", label: "Nodes the capture walked", volatility: "normal" },
    { namespace: "web", path: "evidence.elements.candidates", type: "integer", elementKind: "count", label: "Capture candidates", volatility: "normal" },
    { namespace: "web", path: "evidence.elements.matched", type: "integer", elementKind: "count", label: "Elements past the capture filter", volatility: "normal" },
    { namespace: "web", path: "evidence.elements.returned", type: "integer", elementKind: "count", label: "Elements the capture returned", volatility: "normal" },
    { namespace: "web", path: "evidence.elements.changed", type: "integer", elementKind: "count", label: "Elements changed since the last capture", volatility: "rapid" },
    { namespace: "web", path: "evidence.elements.recentlyInteracted", type: "integer", elementKind: "count", label: "Elements recently interacted with", volatility: "rapid" },
    // The browser's own cap, at the funnel it belongs to. `elements.captureTruncated` is the same fact outside this prefix.
    { namespace: "web", path: "evidence.elements.truncated", type: "boolean", elementKind: "status", label: "Capture dropped elements", volatility: "normal" },
    { namespace: "web", path: "evidence.loading.documentState", type: "string", elementKind: "status", label: "Document ready state", volatility: "rapid" },
    { namespace: "web", path: "evidence.loading.busy", type: "boolean", elementKind: "status", label: "Page busy", volatility: "rapid" },
    { namespace: "web", path: "evidence.loading.pendingNavigation", type: "boolean", elementKind: "status", label: "Navigation in flight", volatility: "rapid" },
    { namespace: "web", path: "evidence.loading.busyRegions", type: "json", elementKind: "collection", label: "Regions marked busy", volatility: "rapid" },
    { namespace: "web", path: "evidence.loading.indicators", type: "json", elementKind: "collection", label: "Loading indicators on screen", volatility: "rapid" },
    // `evidence.navigation.url` is deliberately absent: `page.url` already is it.
    { namespace: "web", path: "evidence.navigation.origin", type: "string", elementKind: "url", label: "Page origin", volatility: "slow" },
    { namespace: "web", path: "evidence.navigation.path", type: "string", elementKind: "route", label: "Page path", volatility: "slow" },
    { namespace: "web", path: "evidence.navigation.referrer", type: "string", elementKind: "url", label: "Referrer", volatility: "slow" },
    { namespace: "web", path: "evidence.navigation.type", type: "string", elementKind: "status", label: "How the document was reached", volatility: "slow" },
    { namespace: "web", path: "evidence.navigation.redirects", type: "integer", elementKind: "count", label: "Redirects on the way here", volatility: "normal" },
    { namespace: "web", path: "evidence.navigation.historyLength", type: "integer", elementKind: "count", label: "Session history entries", volatility: "normal" },
    { namespace: "web", path: "evidence.navigation.visibility", type: "string", elementKind: "visibility", label: "Document visibility", volatility: "rapid" },
    // "Is anything standing in front of the page" decides whether an action may
    // be attempted at all, so it is a comparable count rather than a blob read.
    { namespace: "web", path: "evidence.dialogs.openCount", type: "integer", elementKind: "count", label: "Open dialogs", volatility: "rapid" },
    { namespace: "web", path: "evidence.dialogs.modal", type: "boolean", elementKind: "status", label: "A modal dialog is open", volatility: "rapid" },
    { namespace: "web", path: "evidence.dialogs.armPending", type: "boolean", elementKind: "status", label: "Native dialog arming unacknowledged", volatility: "rapid" },
    { namespace: "web", path: "evidence.dialogs.open", type: "json", elementKind: "collection", label: "Open dialogs", volatility: "rapid" },
    { namespace: "web", path: "evidence.dialogs.lastNative", type: "json", elementKind: "json", label: "Last native dialog answered", volatility: "rapid" },
    { namespace: "web", path: "evidence.overlays.tested", type: "integer", elementKind: "count", label: "Controls hit-tested for occlusion", volatility: "rapid" },
    { namespace: "web", path: "evidence.overlays.blockedCount", type: "integer", elementKind: "count", label: "Controls something else answers for", volatility: "rapid" },
    { namespace: "web", path: "evidence.overlays.blockers", type: "json", elementKind: "collection", label: "Blocking overlays", volatility: "rapid" },
    { namespace: "web", path: "evidence.regions", type: "json", elementKind: "collection", label: "Landmark regions", volatility: "slow" },
    { namespace: "web", path: "evidence.repeating", type: "json", elementKind: "collection", label: "Repeating structures", volatility: "normal" },
    { namespace: "web", path: "evidence.forms", type: "json", elementKind: "collection", label: "Forms on the page", volatility: "slow" },
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
