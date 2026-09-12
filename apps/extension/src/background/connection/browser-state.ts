// The browser's own state as the web-automation domain sees it: which pages can
// be recorded, and the tab state update sent to the gateway.

import {
  createWebAutomationStateFromTabs,
  createWebAutomationStateUpdate,
  WEB_AUTOMATION_INPUT_IDS
} from "@fluxiq-web-extension/domain/client";
import type {
  ClientGatewayCapability,
  ClientGatewayStateUpdate,
  JsonObject,
  RecordingState,
  TabDescriptor,
  UnsupportedPageState
} from "../../shared/protocol";
import {
  UNSUPPORTED_BROWSER_PAGE_REASON,
  UNSUPPORTED_STORE_PAGE_REASON,
  unsupportedAutomationPageReason
} from "../../runtime";
import { compactObject } from "./value-readers";

// Recording and automation ask one question -- which pages the extension cannot
// drive -- so `runtime/unsupported-page.ts` owns the list and this maps its
// answer onto what recording reports. Keeping a second pattern here is what let
// the two drift: this one required "://", so `about:blank`, `view-source:` and
// `data:` URLs slipped past it, and it matched neither the current Chrome store
// host nor the Edge and Firefox galleries.
//
// Two things the recording path needs that the shared rule does not carry: the
// wording names *recording*, because that is the operation the panel is warning
// about, and the state it renders carries the URL beside the reason.
const RECORDING_REASONS: Readonly<Record<string, string>> = {
  [UNSUPPORTED_BROWSER_PAGE_REASON]: "Browser and extension pages cannot be recorded.",
  [UNSUPPORTED_STORE_PAGE_REASON]: "Browser web store pages cannot be recorded."
};

export function unsupportedPageForUrl(url: string | undefined): UnsupportedPageState | undefined {
  const reason = unsupportedAutomationPageReason(url);
  // A reason implies a non-empty URL -- the shared rule refuses an absent one --
  // but only the check narrows it for the compiler.
  if (reason === undefined || url === undefined) return undefined;
  return { url, reason: RECORDING_REASONS[reason] ?? reason };
}

export function browserStateFromTabs(active: TabDescriptor | undefined, tabs: TabDescriptor[], recordingState: RecordingState): ClientGatewayStateUpdate {
  return createWebAutomationStateUpdate({
    ...(active?.tabId === undefined ? {} : { activeContextId: String(active.tabId) }),
    recording: recordingState === "recording",
    contexts: tabs.map((tab) => compactObject({
      contextId: String(tab.tabId),
      url: tab.url,
      title: tab.title,
      faviconUrl: tab.favIconUrl,
      active: tab.active,
      metadata: compactObject({
        kind: "browser.tab",
        windowId: tab.windowId,
        status: tab.status
      }) as JsonObject
    }) as JsonObject),
    state: browserStateSnapshotFromTabs(active, tabs, recordingState, Date.now()) as unknown as JsonObject,
    metadata: { inputId: WEB_AUTOMATION_INPUT_IDS.browserState }
  });
}

export function browserStateSnapshotFromTabs(
  active: TabDescriptor | undefined,
  tabs: TabDescriptor[],
  recordingState: RecordingState,
  timestamp: number,
  sourceId?: string
): unknown {
  const options: { timestamp?: number; sourceId?: string; recording?: boolean; permissions?: string[] } = {
    timestamp,
    recording: recordingState === "recording",
    permissions: ["activeTab", "scripting", "storage", "tabs"]
  };
  if (sourceId !== undefined) options.sourceId = sourceId;
  return createWebAutomationStateFromTabs(active, tabs, options);
}

export function describeActiveTabLike(tab: chrome.tabs.Tab): {
  tabId: number;
  windowId?: number;
  url?: string;
  title?: string;
  active?: boolean;
  status?: string;
} {
  const result: { tabId: number; windowId?: number; url?: string; title?: string; active?: boolean; status?: string } = {
    tabId: tab.id ?? -1
  };
  if (tab.windowId !== undefined) result.windowId = tab.windowId;
  if (tab.url !== undefined) result.url = tab.url;
  if (tab.title !== undefined) result.title = tab.title;
  if (tab.active !== undefined) result.active = tab.active;
  if (tab.status !== undefined) result.status = tab.status;
  return result;
}

export function actionTypesFromCapabilities(capabilities: ClientGatewayCapability[]): string[] {
  return [...new Set(capabilities.flatMap((capability) => capability.actionTypes ?? []))];
}
