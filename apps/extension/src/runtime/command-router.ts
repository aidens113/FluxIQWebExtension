import type { BrowserActionCommand, BrowserActionResult } from "../shared/protocol";
import { SESSION_PAGE_LOAD_PACE } from "../background/page-pace";
import { browserActionFailure, runBrowserActionCommand } from "./action-runner";
import type { MergeFrameSnapshots } from "./look-across-frames";
import { runSnapshotCapture } from "./snapshot-runner";

export type ExtensionRuntimeCommandRouterOptions = {
  activeTabId(): number | undefined;
  unsupportedPageReason(): string | undefined;
  /** The origins of FluxIQ's own pages, which a navigation never takes over. */
  ownOrigins?(): readonly string[];
  attachTabForRecording(tabId: number): Promise<void>;
  captureActiveSnapshot(label: string): Promise<void>;
  sendActionResult(result: BrowserActionResult, tabId?: number, frameId?: number): Promise<void>;
  /** The background worker's frame merge, which a look that names no frame answers with. */
  mergeFrameSnapshots?: MergeFrameSnapshots;
};

export class ExtensionRuntimeCommandRouter {
  constructor(private readonly options: ExtensionRuntimeCommandRouterOptions) {}

  async captureSnapshot(): Promise<void> {
    await runSnapshotCapture({ captureActiveSnapshot: (label) => this.options.captureActiveSnapshot(label) });
  }

  async executeAction(action: BrowserActionCommand): Promise<void> {
    const request: Parameters<typeof runBrowserActionCommand>[0] = {
      action,
      // Every command FluxIQ sends shares the worker's one page-load pace, so
      // the pages one read, navigation or dry run loads on a site are spaced
      // from the last one's (`background/page-pace/`).
      pace: SESSION_PAGE_LOAD_PACE,
      attachTabForRecording: (targetTabId) => this.options.attachTabForRecording(targetTabId)
    };
    const activeTabId = this.options.activeTabId();
    const unsupportedPageReason = this.options.unsupportedPageReason();
    if (activeTabId !== undefined) request.activeTabId = activeTabId;
    if (unsupportedPageReason !== undefined) request.unsupportedPageReason = unsupportedPageReason;
    const ownOrigins = this.options.ownOrigins?.();
    if (ownOrigins?.length) request.ownOrigins = ownOrigins;
    if (this.options.mergeFrameSnapshots) request.mergeFrameSnapshots = this.options.mergeFrameSnapshots;
    try {
      const { result, tabId, frameId } = await runBrowserActionCommand(request);
      await this.options.sendActionResult(result, tabId, frameId);
    } catch (error) {
      await this.options.sendActionResult(browserActionFailure(action, error instanceof Error ? error.message : "Runtime action failed."));
    }
  }
}
