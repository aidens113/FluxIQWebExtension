import type { BrowserActionCommand, BrowserActionResult } from "../shared/protocol";
import { sendToTab } from "../background/tabs";
import { resolveAutomationTab, waitForTabReady } from "./automation-tab";

export type BrowserActionRunRequest = {
  action: BrowserActionCommand;
  activeTabId?: number;
  unsupportedPageReason?: string;
  attachTabForRecording(tabId: number): Promise<void>;
};

export type BrowserActionRunResult = {
  result: BrowserActionResult;
  tabId?: number;
  frameId?: number;
};

export async function runBrowserActionCommand(request: BrowserActionRunRequest): Promise<BrowserActionRunResult> {
  const action = request.action;
  const isNavigation = action.actionType === "web.browser.navigate" && Boolean(action.url);
  const tabRequest: Parameters<typeof resolveAutomationTab>[0] = { active: true };
  if (isNavigation && action.url) {
    tabRequest.forceNew = true;
    tabRequest.initialUrl = action.url;
  } else if (action.tabId !== undefined) {
    tabRequest.requestedTabId = action.tabId;
  }
  const tabId = await resolveAutomationTab(tabRequest);
  const unsupportedReason = action.tabId === undefined || isNavigation ? unsupportedPageReasonForAction(action) : request.unsupportedPageReason;
  if (unsupportedReason && isMutatingAction(action.actionType)) return withTarget(actionFailure(action, unsupportedReason), tabId, action.frameId);
  if (isNavigation && action.url) {
    const startedAt = Date.now();
    await request.attachTabForRecording(tabId);
    return withTarget({
        commandId: action.commandId,
        actionType: action.actionType,
        status: "succeeded",
        message: "Navigation completed.",
        url: action.url,
        startedAt,
        finishedAt: Date.now()
      }, tabId, action.frameId);
  }
  await waitForTabReady(tabId);
  await request.attachTabForRecording(tabId);
  const frameId = action.frameId ?? 0;
  return withTarget(await sendToTab<BrowserActionResult>(tabId, {
    type: "executeAction",
    action,
    topFrameOnly: action.frameId === undefined
  }, frameId), tabId, frameId);
}

export function browserActionFailure(action: BrowserActionCommand, message: string): BrowserActionResult {
  return actionFailure(action, message);
}

function unsupportedPageReasonForAction(action: BrowserActionCommand): string | undefined {
  const url = action.actionType === "web.browser.navigate" ? action.url : undefined;
  if (!url) return undefined;
  if (/^(chrome|edge|brave|opera|vivaldi|about|moz-extension|chrome-extension):\/\//.test(url)) return "Browser and extension pages cannot be automated.";
  if (/^https:\/\/chrome\.google\.com\/webstore/.test(url)) return "Browser web store pages cannot be automated.";
  return undefined;
}

function isMutatingAction(actionType: string): boolean {
  return actionType !== "web.dom.extract" &&
    actionType !== "web.dom.capture_snapshot" &&
    actionType !== "web.dom.wait_for_selector" &&
    actionType !== "web.dom.wait_for_text";
}

function actionFailure(action: BrowserActionCommand, message: string): BrowserActionResult {
  const now = Date.now();
  return {
    commandId: action.commandId,
    actionType: action.actionType,
    status: "failed",
    message,
    startedAt: now,
    finishedAt: now
  };
}

function withTarget(result: BrowserActionResult, tabId?: number, frameId?: number): BrowserActionRunResult {
  return {
    result,
    ...(tabId !== undefined ? { tabId } : {}),
    ...(frameId !== undefined ? { frameId } : {})
  };
}
