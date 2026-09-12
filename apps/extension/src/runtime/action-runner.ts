import type { BrowserActionCommand, BrowserActionResult } from "../shared/protocol";
import { sendToTab } from "../background/tabs";
import {
  navigationUnexpectedFailure,
  workerActionFailedFailure,
  workerActionResult,
  workerBlockedFailure
} from "./action-results";
import {
  currentAutomationTabId,
  readTabUrl,
  resolveAutomationTab,
  setAutomationTab,
  waitForTabReady
} from "./automation-tab";
import { runBrowserDownloadAction } from "./browser-download";
import { runBrowserTabAction } from "./browser-tab";
import { frameIdForAction, opensNewTab, tabIdForAction } from "./command-options";
import { compareNavigatedUrl } from "./navigation-outcome";
import { unsupportedAutomationPageReason } from "./unsupported-page";

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

  // Tab and download act on the browser, not on a document. They run before any
  // tab is resolved -- so opening a tab does not first create an automation tab
  // to open it from -- and the page guard, which is about the document an
  // action needs, does not apply to them.
  if (action.actionType === "web.browser.tab") {
    const result = await runBrowserTabAction(action);
    const selected = currentAutomationTabId();
    if (result.status === "succeeded" && selected !== undefined) await request.attachTabForRecording(selected);
    return withTarget(result, selected, undefined);
  }
  if (action.actionType === "web.browser.download") {
    return withTarget(await runBrowserDownloadAction(action), currentAutomationTabId(), undefined);
  }

  const startedAt = Date.now();
  const isNavigation = action.actionType === "web.browser.navigate" && Boolean(action.url);
  const tabId = await resolveAutomationTab(tabRequestFor(action, request, isNavigation));
  const frameId = frameIdForAction(action);

  const unsupportedReason = await unsupportedPageReasonFor(action, request, tabId, isNavigation);
  if (unsupportedReason !== undefined && isMutatingAction(action.actionType)) {
    return withTarget(unsupportedPageFailure(action, startedAt, unsupportedReason), tabId, frameId);
  }

  if (isNavigation && action.url) {
    setAutomationTab(tabId);
    await request.attachTabForRecording(tabId);
    // resolveAutomationTab has already waited for the tab to settle, so the URL
    // read here is where the browser actually committed the navigation.
    return withTarget(navigationResult(action, startedAt, action.url, await readTabUrl(tabId)), tabId, frameId);
  }

  await waitForTabReady(tabId);
  await request.attachTabForRecording(tabId);
  const targetFrameId = frameId ?? 0;
  return withTarget(await sendToTab<BrowserActionResult>(tabId, {
    type: "executeAction",
    action,
    topFrameOnly: frameId === undefined
  }, targetFrameId), tabId, targetFrameId);
}

/** The failed result for an action that threw before or while it ran. */
export function browserActionFailure(action: BrowserActionCommand, message: string): BrowserActionResult {
  const expected = "the action to run";
  return workerActionResult(action, Date.now(), {
    status: "failed",
    message,
    validation: { status: "failed", expected, actual: message },
    failure: workerActionFailedFailure("web.action.failed", expected, message)
  });
}

/**
 * Which tab the action runs in. A navigation reuses the automation tab unless
 * it asked for a new one or named a tab of its own; before Phase 1.2 step 4 it
 * always opened a new tab, abandoning the page the Flow had reached.
 */
function tabRequestFor(
  action: BrowserActionCommand,
  request: BrowserActionRunRequest,
  isNavigation: boolean
): Parameters<typeof resolveAutomationTab>[0] {
  const tabRequest: Parameters<typeof resolveAutomationTab>[0] = { active: true };
  const namedTabId = tabIdForAction(action);
  if (isNavigation && action.url) {
    tabRequest.initialUrl = action.url;
    if (opensNewTab(action)) tabRequest.forceNew = true;
    else if (namedTabId !== undefined) tabRequest.requestedTabId = namedTabId;
    return tabRequest;
  }
  if (namedTabId !== undefined) tabRequest.requestedTabId = namedTabId;
  else if (request.activeTabId !== undefined) tabRequest.requestedTabId = request.activeTabId;
  return tabRequest;
}

/**
 * A navigation is judged by where it is going; every other action by the page
 * it would run on, read from the tab itself rather than from the connection's
 * last observation, so a stale or missing observation cannot let an action
 * through to a page that can never answer it.
 */
async function unsupportedPageReasonFor(
  action: BrowserActionCommand,
  request: BrowserActionRunRequest,
  tabId: number,
  isNavigation: boolean
): Promise<string | undefined> {
  if (isNavigation) return unsupportedAutomationPageReason(action.url);
  return unsupportedAutomationPageReason(await readTabUrl(tabId)) ?? request.unsupportedPageReason;
}

function navigationResult(
  action: BrowserActionCommand,
  startedAt: number,
  requested: string,
  landed: string | undefined
): BrowserActionResult {
  const comparison = compareNavigatedUrl(requested, landed);
  if (comparison.matched) {
    return workerActionResult(action, startedAt, {
      status: "succeeded",
      message: "Navigation completed.",
      validation: { status: "passed", expected: comparison.expected, actual: comparison.actual },
      ...(landed !== undefined ? { url: landed } : {})
    });
  }
  return workerActionResult(action, startedAt, {
    status: "failed",
    message: `Navigation landed on ${comparison.actual}, not ${comparison.expected}.`,
    validation: { status: "failed", expected: comparison.expected, actual: comparison.actual },
    failure: navigationUnexpectedFailure(comparison.expected, comparison.actual),
    ...(landed !== undefined ? { url: landed } : {})
  });
}

function unsupportedPageFailure(action: BrowserActionCommand, startedAt: number, reason: string): BrowserActionResult {
  const expected = "a page the extension can automate";
  return workerActionResult(action, startedAt, {
    status: "failed",
    message: reason,
    validation: { status: "failed", expected, actual: reason },
    failure: workerBlockedFailure("web.page.unsupported", { expected, actual: reason })
  });
}

/** The actions that only observe or wait, which an unsupported page does not block. */
function isMutatingAction(actionType: string): boolean {
  return actionType !== "web.dom.extract" &&
    actionType !== "web.dom.extract_list" &&
    actionType !== "web.dom.assert" &&
    actionType !== "web.dom.capture_snapshot" &&
    actionType !== "web.dom.wait_for_selector" &&
    actionType !== "web.dom.wait_for_text";
}

function withTarget(result: BrowserActionResult, tabId?: number, frameId?: number): BrowserActionRunResult {
  return {
    result,
    ...(tabId !== undefined ? { tabId } : {}),
    ...(frameId !== undefined ? { frameId } : {})
  };
}
