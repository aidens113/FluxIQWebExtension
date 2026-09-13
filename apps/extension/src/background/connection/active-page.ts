// Where the browser currently is: the active tab, the URL it is showing, and
// whether that page can be recorded or driven at all. Everything that needs to
// know which page an event or an action belongs to reads it from here, and the
// two paths that change it -- a tab the browser updated, and a tab the server
// asked for -- live beside the state they change.
//
// It owns no recording state. Whether a tab is attached for recording is the
// caller's decision, reached through the deps below.

import {
  createWebAutomationStateFromTabs,
  createWebAutomationStateUpdate,
  WEB_AUTOMATION_INPUT_IDS
} from "@fluxiq-web-extension/domain/client";
import type {
  ActivityEntry,
  ConnectionState,
  JsonObject,
  RecordingState,
  TabDescriptor,
  UnsupportedPageState
} from "../../shared/protocol";
import { browserStateFromTabs, describeActiveTabLike, unsupportedPageForUrl } from "./browser-state";
import type { GatewayMessageSender } from "./gateway-session";
import { eventSourceId } from "./recording-manifest";
import { compactObject } from "./value-readers";

export type ActivePageDeps = {
  readonly send: GatewayMessageSender;
  readonly gatewayState: () => ConnectionState;
  readonly clientId: () => string;
  readonly recordingState: () => RecordingState;
  readonly attachTabForRecording: (tabId: number) => Promise<void>;
  readonly activeTab: () => Promise<TabDescriptor | undefined>;
  readonly allTabs: () => Promise<TabDescriptor[]>;
  readonly onActivity: (kind: string, label: string, detail?: string, tone?: ActivityEntry["tone"]) => void;
  readonly emitStatus: () => void;
  // Re-entry through the facade. Selecting a tab finishes on the same public
  // update path a browser-driven tab change takes, so a caller that has
  // replaced that path still sees the selection.
  readonly updateTab: (tab: chrome.tabs.Tab) => Promise<void>;
};

export class ActivePage {
  private currentTabId: number | undefined;
  private currentUrl: string | undefined;
  private currentUnsupported: UnsupportedPageState | undefined;

  constructor(private readonly deps: ActivePageDeps) {}

  tabId(): number | undefined {
    return this.currentTabId;
  }

  url(): string | undefined {
    return this.currentUrl;
  }

  unsupported(): UnsupportedPageState | undefined {
    return this.currentUnsupported;
  }

  setUnsupported(state: UnsupportedPageState | undefined): void {
    this.currentUnsupported = state;
  }

  setTabId(tabId: number): void {
    this.currentTabId = tabId;
  }

  // A finished runtime action reports the tab and URL it ended on, which is
  // more current than the last tab event the browser sent.
  noteActionResult(tabId: number | undefined, url: string | undefined): void {
    if (tabId !== undefined) this.currentTabId = tabId;
    if (url) this.currentUrl = url;
  }

  async refresh(): Promise<void> {
    const tab = await this.deps.activeTab();
    this.currentTabId = tab?.tabId;
    this.currentUrl = tab?.url;
    this.currentUnsupported = unsupportedPageForUrl(tab?.url);
    this.deps.emitStatus();
  }

  async sendBrowserState(): Promise<void> {
    await this.deps.send("client.state_update", browserStateFromTabs(await this.deps.activeTab(), await this.deps.allTabs(), this.deps.recordingState()));
  }

  async handleTabUpdate(tab: chrome.tabs.Tab): Promise<void> {
    const becameActive = Boolean(tab.active && tab.id !== undefined && this.currentTabId !== tab.id);
    if (tab.active && tab.id !== undefined) {
      this.currentTabId = tab.id;
      this.currentUrl = tab.url;
      this.currentUnsupported = unsupportedPageForUrl(tab.url);
      this.deps.emitStatus();
    }
    if (!tab.id) return;
    if (tab.active && this.deps.recordingState() === "recording" && !this.currentUnsupported) {
      await this.deps.attachTabForRecording(tab.id).catch(() => undefined);
      if (becameActive) this.deps.onActivity("tab", "Recording active tab", tab.url ?? `Tab ${tab.id}`);
    }
    if (this.deps.gatewayState() === "connected") {
      await this.deps.send("client.state_update", createWebAutomationStateUpdate({
        activeContextId: String(tab.id),
        contexts: [compactObject({ contextId: String(tab.id), url: tab.url, title: tab.title, status: tab.status }) as JsonObject],
        recording: this.deps.recordingState() === "recording",
        state: createWebAutomationStateFromTabs(describeActiveTabLike(tab), [describeActiveTabLike(tab)], {
          timestamp: Date.now(),
          sourceId: eventSourceId(this.deps.clientId()),
          recording: this.deps.recordingState() === "recording",
          permissions: ["activeTab", "scripting", "storage", "tabs"]
        }) as unknown as JsonObject,
        metadata: { reason: "tab-updated", inputId: WEB_AUTOMATION_INPUT_IDS.browserState }
      }));
      await this.sendBrowserState();
    }
  }

  async select(tabId: number): Promise<void> {
    const tab = await chrome.tabs.update(tabId, { active: true });
    if (tab.id !== tabId || unsupportedPageForUrl(tab.url)) {
      throw new Error("The requested automation tab is unavailable or unsupported.");
    }
    await this.deps.updateTab({ ...tab, active: true });
  }
}
