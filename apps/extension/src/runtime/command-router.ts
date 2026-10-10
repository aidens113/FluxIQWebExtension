import { webAutomationFactCheckResultPayload, type WebAutomationFactCheckCommand } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand, BrowserActionResult, ClientGatewayActionResult } from "../shared/protocol";
import { SESSION_PAGE_LOAD_PACE } from "../background/page-pace";
import { sendToTab } from "../background/tabs";
import { browserActionFailure, runBrowserActionCommand } from "./action-runner";
import { currentAutomationTabId } from "./automation-tab";
import { runFactCheck } from "./fact-check-runner";
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
  /**
   * Sends a fact check's answer (plan B1) as the gateway result it is. A fact
   * check is not a browser action, so it has no runtime status, chat card or
   * recorded event, and does not pass through `sendActionResult`.
   */
  sendGatewayResult?(result: ClientGatewayActionResult): Promise<void>;
  /** The background worker's frame merge, which a look that names no frame answers with. */
  mergeFrameSnapshots?: MergeFrameSnapshots;
  /** Told where a command is about to be sent, before it is (the in-flight record, plan B3). */
  noteDispatch?(commandId: string, tabId: number, frameId: number): Promise<void>;
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
    const noteDispatch = this.options.noteDispatch;
    if (noteDispatch) request.noteDispatch = async (tabId, frameId) => await noteDispatch(action.commandId, tabId, frameId);
    try {
      const { result, tabId, frameId } = await runBrowserActionCommand(request);
      await this.options.sendActionResult(result, tabId, frameId);
    } catch (error) {
      await this.options.sendActionResult(browserActionFailure(action, error instanceof Error ? error.message : "Runtime action failed."));
    }
  }

  /**
   * Answers a fact check from the page the run stands on -- the automation tab,
   * or the active one before any action has driven a tab -- with no wait
   * (`fact-check-runner.ts`). The route never fails the command: a page that
   * could not be read answers its claims `unknown`, which is the answer.
   */
  async evaluateFacts(check: WebAutomationFactCheckCommand): Promise<void> {
    const startedAt = Date.now();
    const result = await runFactCheck(check.request, {
      tabId: currentAutomationTabId() ?? this.options.activeTabId(),
      send: (tabId, message, frameId) => sendToTab(tabId, message, frameId)
    });
    await this.options.sendGatewayResult?.({
      commandId: check.commandId,
      status: "succeeded",
      startedAt,
      completedAt: Date.now(),
      payload: webAutomationFactCheckResultPayload(result)
    });
  }
}
