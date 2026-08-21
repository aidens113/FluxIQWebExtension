import type { BrowserActionCommand, BrowserActionResult } from "../shared/protocol";
import { browserActionFailure, runBrowserActionCommand } from "./action-runner";
import { runSnapshotCapture } from "./snapshot-runner";

export type ExtensionRuntimeCommandRouterOptions = {
  activeTabId(): number | undefined;
  unsupportedPageReason(): string | undefined;
  attachTabForRecording(tabId: number): Promise<void>;
  captureActiveSnapshot(label: string): Promise<void>;
  sendActionResult(result: BrowserActionResult, tabId?: number, frameId?: number): Promise<void>;
};

export class ExtensionRuntimeCommandRouter {
  constructor(private readonly options: ExtensionRuntimeCommandRouterOptions) {}

  async captureSnapshot(): Promise<void> {
    await runSnapshotCapture({ captureActiveSnapshot: (label) => this.options.captureActiveSnapshot(label) });
  }

  async executeAction(action: BrowserActionCommand): Promise<void> {
    const request: Parameters<typeof runBrowserActionCommand>[0] = {
      action,
      attachTabForRecording: (targetTabId) => this.options.attachTabForRecording(targetTabId)
    };
    const activeTabId = this.options.activeTabId();
    const unsupportedPageReason = this.options.unsupportedPageReason();
    if (activeTabId !== undefined) request.activeTabId = activeTabId;
    if (unsupportedPageReason !== undefined) request.unsupportedPageReason = unsupportedPageReason;
    try {
      const { result, tabId, frameId } = await runBrowserActionCommand(request);
      await this.options.sendActionResult(result, tabId, frameId);
    } catch (error) {
      await this.options.sendActionResult(browserActionFailure(action, error instanceof Error ? error.message : "Runtime action failed."));
    }
  }
}
