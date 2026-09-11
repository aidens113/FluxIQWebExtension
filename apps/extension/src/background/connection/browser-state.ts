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
import { compactObject } from "./value-readers";

export function unsupportedPageForUrl(url: string | undefined): UnsupportedPageState | undefined {
  if (!url) return undefined;
  if (/^(chrome|edge|brave|opera|vivaldi|about|moz-extension|chrome-extension):\/\//.test(url)) {
    return { url, reason: "Browser and extension pages cannot be recorded." };
  }
  if (/^https:\/\/chrome\.google\.com\/webstore/.test(url)) {
    return { url, reason: "Browser web store pages cannot be recorded." };
  }
  return undefined;
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
