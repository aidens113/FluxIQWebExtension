import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand, BrowserActionResult } from "../shared/protocol";
import { allTabFrames, sendToTab, unreachableFrameReason } from "../background/tabs";
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

/** The id the browser always gives a tab's main frame; every child frame has a positive one. */
const TOP_FRAME_ID = 0;

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
  return await runActionInFrame(action, startedAt, tabId, frameId);
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

/**
 * The page cannot be automated at all -- a `chrome://` page, an extension page,
 * a web store. `ACTION_REJECTED` is the set's member for a refusal, and the
 * page itself is what is refused: `UNSUPPORTED_TYPE` names an action type the
 * client will not run, which is not this. The reason travels in `actual`, where
 * the code `web.page.unsupported` used to carry it and no consumer could name
 * it, because it was in no set.
 */
function unsupportedPageFailure(action: BrowserActionCommand, startedAt: number, reason: string): BrowserActionResult {
  const expected = "a page the extension can automate";
  return workerActionResult(action, startedAt, {
    status: "failed",
    message: reason,
    validation: { status: "failed", expected, actual: reason },
    failure: workerBlockedFailure(WEB_AUTOMATION_FAILURE_CODES.ACTION_REJECTED, { expected, actual: reason })
  });
}

/**
 * Delivers the action to the frame it is addressed to, or reports why that
 * frame could not be reached.
 *
 * The address travels twice, because the two carriers answer different
 * questions. `chrome.tabs.sendMessage`'s `frameId` option is what makes the
 * message arrive at one frame instead of every frame in the tab. The `frameId`
 * in the message body is what lets the receiving frame confirm it is the
 * addressee (`content/message-handler.ts`), which matters because the runtime
 * is not the only sender: `packages/test-runner` broadcasts `executeAction` to
 * a whole tab, and there the option does not exist. `topFrameOnly` stays for
 * the same reason -- it is the older half of that contract, and those senders
 * still send it.
 *
 * An action that names no frame runs in the top frame, which is the frame a
 * Flow means when it says nothing.
 *
 * A child frame is checked twice before anything is sent: that the tab still
 * has it, and that something in it is listening. The second check is not
 * redundant. `attachTabForRecording` has already run `ensureContentScript` for
 * the top frame, and an extension reload or update leaves every other
 * already-loaded frame without a script while the frames themselves survive --
 * so a frame that exists can still answer nothing, and a command sent to it is
 * neither refused nor answered. Nothing upstream puts a deadline on a web
 * action, so that is a hang with no end, which is worse than any failure.
 */
async function runActionInFrame(
  action: BrowserActionCommand,
  startedAt: number,
  tabId: number,
  frameId: number | undefined
): Promise<BrowserActionRunResult> {
  const targetFrameId = frameId ?? TOP_FRAME_ID;
  if (targetFrameId !== TOP_FRAME_ID) {
    const absent = await absentFrameReason(tabId, targetFrameId);
    if (absent !== undefined) {
      return withTarget(missingFrameFailure(action, startedAt, targetFrameId, absent), tabId, targetFrameId);
    }
    const unreachable = await unreachableFrameReason(tabId, targetFrameId);
    if (unreachable !== undefined) {
      return withTarget(unreachableFrameFailure(action, startedAt, targetFrameId, unreachable), tabId, targetFrameId);
    }
  }
  return withTarget(await sendToTab<BrowserActionResult>(tabId, {
    type: "executeAction",
    action,
    frameId: targetFrameId,
    topFrameOnly: frameId === undefined
  }, targetFrameId), tabId, targetFrameId);
}

/**
 * Which frames the tab does have, when it does not have the one the action
 * names; undefined when the frame is there, or when the browser will not say.
 *
 * A frame id belongs to a tab and is reassigned every time that frame
 * navigates, so an id recorded during capture can name nothing by the time a
 * Flow replays it. Without this check the send rejects with Chrome's "Could not
 * establish connection", which the command router turns into a generic
 * `web.action.failed` naming no frame at all.
 *
 * `allTabFrames` answers `[]` when `webNavigation` cannot enumerate the tab. An
 * empty list is "unknown", not "no frames", so the action is sent anyway and
 * judged by its own outcome -- the same rule `unsupportedPageReasonFor` follows
 * for a tab whose URL cannot be read.
 */
async function absentFrameReason(tabId: number, frameId: number): Promise<string | undefined> {
  const frames = await allTabFrames(tabId);
  if (frames.length === 0) return undefined;
  if (frames.some((frame) => frame.frameId === frameId)) return undefined;
  return `the tab has ${frames.map((frame) => `frame ${frame.frameId}`).join(", ")}`;
}

/**
 * The frame is part of the address the action could not resolve, so this is
 * `TARGET_NOT_FOUND` -- and retryable, because a frame the page has not
 * finished creating may still appear.
 */
function missingFrameFailure(
  action: BrowserActionCommand,
  startedAt: number,
  frameId: number,
  actual: string
): BrowserActionResult {
  const expected = `frame ${frameId} in the tab`;
  return workerActionResult(action, startedAt, {
    status: "failed",
    message: `The action is addressed to frame ${frameId}, which this tab does not have.`,
    validation: { status: "failed", expected, actual },
    failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND, { expected, actual })
  });
}

/**
 * The frame is there and has no FluxIQ content script, so the address still
 * resolves to nothing that can act: `TARGET_NOT_FOUND`, on the same reasoning
 * as a frame the tab does not have, and retryable for the same reason -- a
 * frame still loading may be listening by the next attempt.
 *
 * Injection can also be refused outright, on a frame whose origin the manifest
 * does not cover. That is arguably `ACTION_REJECTED`, but telling the two apart
 * means matching on a browser error string, and the two call for the same thing
 * from a Flow: name the frame, and either wait or address a different one.
 */
function unreachableFrameFailure(
  action: BrowserActionCommand,
  startedAt: number,
  frameId: number,
  actual: string
): BrowserActionResult {
  const expected = `frame ${frameId} to be running the FluxIQ content script`;
  return workerActionResult(action, startedAt, {
    status: "failed",
    message: `The action is addressed to frame ${frameId}, which is not running the FluxIQ content script.`,
    validation: { status: "failed", expected, actual },
    failure: webAutomationFailureRecord(WEB_AUTOMATION_FAILURE_CODES.TARGET_NOT_FOUND, { expected, actual })
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
