// Getting the content script into a tab and telling it whether to record.
// Every message name here is part of the background/content contract.

import type { AutomationStudioRecordingCapturePolicy } from "fluxiq/automation-studio/nodes";
import type { FluxIQSettings } from "../../shared/protocol";
import { unsupportedPageForUrl } from "./browser-state";

export type ContentAttachmentDeps = {
  readonly sendToTab: <TResponse = unknown>(tabId: number, message: unknown, frameId?: number) => Promise<TResponse>;
  readonly ensureContentScript: (tabId: number) => Promise<void>;
  /** The settings already under Core's recording-capture policy. */
  readonly settings: () => FluxIQSettings;
  /** Core's policy itself, sent beside them so the page clamps again (`content/message-handler.ts`). */
  readonly capturePolicy?: () => AutomationStudioRecordingCapturePolicy;
  readonly isRecording: () => boolean;
  readonly hasRecordedTab: (tabId: number) => boolean;
  readonly noteRecordedTab: (tabId: number, url: string, timestamp: number) => void;
};

export class ContentAttachment {
  constructor(private readonly deps: ContentAttachmentDeps) {}

  // A tab joining a recording late still has a URL the recording never saw.
  // Claiming it here stops that URL arriving as a navigation the user made.
  async attachTabForRecording(tabId: number): Promise<void> {
    if (this.deps.isRecording() && !this.deps.hasRecordedTab(tabId)) {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url && !unsupportedPageForUrl(tab.url)) this.deps.noteRecordedTab(tabId, tab.url, Date.now());
    }
    await this.deps.ensureContentScript(tabId);
    await this.setRecordingState(tabId, this.deps.isRecording());
  }

  async setRecordingState(tabId: number, recording: boolean, frameId?: number): Promise<void> {
    const capturePolicy = this.deps.capturePolicy?.();
    await this.deps.sendToTab(tabId, { type: "recording", recording, settings: this.deps.settings(), ...(capturePolicy ? { capturePolicy } : {}) }, frameId);
  }

  async broadcast(message: unknown, injectMissing: boolean): Promise<void> {
    const tabs = await chrome.tabs.query({});
    await Promise.allSettled(tabs.map(async (tab) => {
      if (tab.id === undefined || unsupportedPageForUrl(tab.url)) return;
      if (injectMissing) await this.deps.ensureContentScript(tab.id);
      await this.deps.sendToTab(tab.id, message);
    }));
  }
}
