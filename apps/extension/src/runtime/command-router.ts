import { webAutomationFactCheckResultPayload, type WebAutomationFactCheckCommand } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand, BrowserActionResult, ClientGatewayActionResult } from "../shared/protocol";
import { SESSION_PAGE_LOAD_PACE } from "../background/page-pace";
import { OwnPageRefusal, ownPageRefusalFor } from "../background/tab-gate";
import { ownPageRefusedResult } from "./own-page";
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

  /**
   * `leased`: the command came under a host lease (automation-project-agents
   * plan), so one that names no tab runs on the automation tab the lease
   * grants rather than the tab in front (`action-runner.ts`).
   */
  async executeAction(action: BrowserActionCommand, options: { leased?: boolean } = {}): Promise<void> {
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
    if (options.leased === true) request.leased = true;
    const noteDispatch = this.options.noteDispatch;
    if (noteDispatch) request.noteDispatch = async (tabId, frameId) => await noteDispatch(action.commandId, tabId, frameId);
    try {
      const { result, tabId, frameId } = await runBrowserActionCommand(request);
      await this.options.sendActionResult(result, tabId, frameId);
    } catch (error) {
      // FluxIQ's own page, refused by the gate or by the document itself, anywhere in the run: a refusal, not a fault.
      if (error instanceof OwnPageRefusal) await this.options.sendActionResult(ownPageRefusedResult(action, Date.now(), "a tab FluxIQ may automate", error));
      else await this.options.sendActionResult(browserActionFailure(action, error instanceof Error ? error.message : "Runtime action failed."));
    }
  }

  /**
   * Answers a fact check from the page the run stands on -- the automation tab,
   * or the active one before any action has driven a tab -- with no wait
   * (`fact-check-runner.ts`). The route never fails the command: a page that
   * could not be read answers its claims `unknown`, which is the answer.
   *
   * The one exception is FluxIQ's own page: a check that would read the panel
   * is refused out loud (`background/tab-gate/`), not answered `unknown`, so
   * the model learns why rather than meeting a page that never answers.
   */
  async evaluateFacts(check: WebAutomationFactCheckCommand): Promise<void> {
    const startedAt = Date.now();
    const tabId = currentAutomationTabId() ?? this.options.activeTabId();
    const refusal = tabId === undefined ? undefined : await ownPageRefusalFor(tabId);
    if (refusal !== undefined) {
      await this.options.sendGatewayResult?.({ commandId: check.commandId, status: "failed", startedAt, completedAt: Date.now(), message: refusal.message, error: refusal.message });
      return;
    }
    // A document that refuses as FluxIQ's own page -- a tab that moved there
    // after the check above, or a FluxIQ page framed in this one -- makes the
    // check a refusal too, rather than claims quietly answered `unknown`.
    let refused: OwnPageRefusal | undefined;
    const result = await runFactCheck(check.request, {
      tabId,
      send: async (target, message, frameId) => {
        try {
          return await sendToTab(target, message, frameId);
        } catch (error) {
          if (error instanceof OwnPageRefusal) refused = error;
          throw error;
        }
      }
    });
    if (refused !== undefined) {
      await this.options.sendGatewayResult?.({ commandId: check.commandId, status: "failed", startedAt, completedAt: Date.now(), message: refused.message, error: refused.message });
      return;
    }
    await this.options.sendGatewayResult?.({
      commandId: check.commandId,
      status: "succeeded",
      startedAt,
      completedAt: Date.now(),
      payload: webAutomationFactCheckResultPayload(result)
    });
  }
}
