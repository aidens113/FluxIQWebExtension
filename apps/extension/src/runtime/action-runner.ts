import { WEB_AUTOMATION_FAILURE_CODES, webAutomationFailureRecord } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand, BrowserActionResult } from "../shared/protocol";
import { allTabFrames, ensureContentScript, sendToTab, unreachableFrameReason } from "../background/tabs";
import {
  navigationUnexpectedFailure,
  workerActionFailedFailure,
  workerActionResult,
  workerBlockedFailure
} from "./action-results";
import {
  consumeSnapshotReadiness,
  currentAutomationTabId,
  noteSnapshotReadiness,
  readTabTitle,
  readTabUrl,
  resolveAutomationTab,
  setAutomationTab,
  waitForTabReady,
  type TabDriveRecord
} from "./automation-tab";
import { runBrowserDownloadAction } from "./browser-download";
import { runBrowserTabAction } from "./browser-tab";
import { sendClickCheckingLanding } from "./click-landing";
import { frameIdForAction, frameUrlPathForAction, opensNewTab, tabIdForAction } from "./command-options";
import { chooseFrame } from "./frame-address";
import { sendExtractListAcrossDocuments } from "./extract-list-continuation";
import { compareNavigatedUrl, judgeTabMovement } from "./navigation-outcome";
import { navigationTargetTab } from "./navigation-target";
import { unsupportedAutomationPageReason } from "./unsupported-page";

export type BrowserActionRunRequest = {
  action: BrowserActionCommand;
  activeTabId?: number;
  unsupportedPageReason?: string;
  /** The origins of FluxIQ's own pages, which a navigation never takes over (`navigation-target.ts`). */
  ownOrigins?: readonly string[];
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
  // The resolution drives the tab when the action is a navigation, and reports
  // what that drive did: the only evidence there is that the navigation was
  // any work at all.
  const { tabId, drive } = await resolveAutomationTab(await tabRequestFor(action, request, isNavigation));
  const frameId = frameIdForAction(action);

  const unsupportedReason = await unsupportedPageReasonFor(action, request, tabId, isNavigation);
  if (unsupportedReason !== undefined && isMutatingAction(action.actionType)) {
    return withTarget(unsupportedPageFailure(action, startedAt, unsupportedReason), tabId, frameId);
  }

  if (isNavigation && action.url) {
    setAutomationTab(tabId);
    await request.attachTabForRecording(tabId);
    // resolveAutomationTab has already waited for the tab to settle, so the URL
    // read here is where the browser actually committed the navigation -- and
    // the top frame says whether what it committed was the page or Chrome's
    // own error page, which keeps the requested URL in the address bar.
    const loadFailed = (await allTabFrames(tabId)).some((frame) => frame.frameId === TOP_FRAME_ID && frame.errorOccurred);
    const landing = { landed: await readTabUrl(tabId), title: await readTabTitle(tabId), loadFailed, drive };
    return withTarget(navigationResult(action, startedAt, action.url, landing), tabId, frameId);
  }

  if (!await consumeSnapshotReadiness(tabId)) await waitForTabReady(tabId);
  await request.attachTabForRecording(tabId);
  const run = await runActionInFrame(action, startedAt, tabId, frameId);
  if (action.actionType === "web.dom.capture_snapshot" && run.result.status === "succeeded") {
    await noteSnapshotReadiness(tabId, run.result.snapshot?.url ?? await readTabUrl(tabId));
  }
  return run;
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
 * Which tab the action runs in. A navigation that asked for a new tab gets one
 * and one that named a tab drives it; otherwise it drives the page every other
 * action runs on, when that is a page it may take over (`navigation-target.ts`),
 * and only failing that the automation tab, or a new one. Before Phase 1.2 step
 * 4 it always opened a new tab, abandoning the page the Flow had reached; until
 * P17 it preferred the automation tab even over the page in front, so the first
 * navigation of a run opened a tab no later action or observation looked at.
 */
async function tabRequestFor(
  action: BrowserActionCommand,
  request: BrowserActionRunRequest,
  isNavigation: boolean
): Promise<Parameters<typeof resolveAutomationTab>[0]> {
  const tabRequest: Parameters<typeof resolveAutomationTab>[0] = { active: true };
  const namedTabId = tabIdForAction(action);
  if (isNavigation && action.url) {
    tabRequest.initialUrl = action.url;
    if (opensNewTab(action)) tabRequest.forceNew = true;
    else if (namedTabId !== undefined) tabRequest.requestedTabId = namedTabId;
    else {
      const inFront = await navigationTargetTab(request.activeTabId, request.ownOrigins ?? []);
      if (inFront !== undefined) tabRequest.requestedTabId = inFront;
    }
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

/** Where the tab ended up and what putting it there did: everything the navigate's post-condition is judged on. */
type NavigationLanding = {
  landed: string | undefined;
  title: string | undefined;
  loadFailed: boolean;
  drive: TabDriveRecord | undefined;
};

/**
 * A navigation's post-condition, in two halves.
 *
 * The destination is judged first, because landing somewhere else explains
 * everything after it. Then the movement: a navigation that left the tab on
 * the document it already held did nothing, however right its address reads,
 * and reporting that as success is how a Flow carried on against a page it
 * believed it had replaced. Only positive evidence of a no-op fails --
 * `judgeTabMovement` says when it could not tell -- and what it saw is put on
 * the validation either way, because a navigate result carries no snapshot and
 * no element to reconstruct it from.
 */
function navigationResult(
  action: BrowserActionCommand,
  startedAt: number,
  requested: string,
  landing: NavigationLanding
): BrowserActionResult {
  const { landed, title, loadFailed } = landing;
  const page = { ...(landed !== undefined ? { url: landed } : {}), ...(title ? { title } : {}) };
  const comparison = compareNavigatedUrl(requested, landed, loadFailed);
  if (!comparison.matched) {
    return workerActionResult(action, startedAt, {
      status: "failed",
      message: loadFailed ? `The browser could not load ${comparison.expected}.` : `Navigation landed on ${comparison.actual}, not ${comparison.expected}.`,
      validation: { status: "failed", expected: comparison.expected, actual: comparison.actual },
      failure: navigationUnexpectedFailure(comparison.expected, comparison.actual),
      ...page
    });
  }
  const movement = judgeTabMovement(landing.drive);
  if (!movement.moved) {
    const expected = `${comparison.expected}, reached by loading it`;
    const actual = `${comparison.actual}: ${movement.detail}`;
    return workerActionResult(action, startedAt, {
      status: "failed",
      message: `Navigation left the tab on the page it was already showing: ${movement.detail}.`,
      validation: { status: "failed", expected, actual },
      failure: navigationUnexpectedFailure(expected, actual),
      ...page
    });
  }
  return workerActionResult(action, startedAt, {
    status: "succeeded",
    message: "Navigation completed.",
    validation: { status: "passed", expected: comparison.expected, actual: `${comparison.actual}: ${movement.detail}` },
    ...page
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
 * Flow means when it says nothing. A click is also judged by where its tab
 * landed: one the server refused fails it (`click-landing.ts`).
 *
 * A child frame is checked twice before anything is sent: that the tab still
 * has it, and that something in it is listening. The second check is not
 * redundant. `attachTabForRecording` has already run `ensureContentScript` for
 * the top frame, and an extension reload or update leaves every other
 * already-loaded frame without a script while the frames themselves survive --
 * so a frame that exists can still answer nothing, and a command sent to it is
 * neither refused nor answered. Core does stop waiting -- on a Flow action once
 * its node's timeout and Core's answer margin have passed, and on a command sent
 * with no timeout after the gateway's default -- but it can then say only that
 * the client never answered, while the command still hangs here, which is worse
 * than any failure these checks can report.
 *
 * Before either check, a child frame the action also names by its document's
 * path is found by that path (`frame-address.ts`), and the recorded id only
 * breaks a tie: Chrome renumbers a frame when it navigates, and a Flow reloads
 * its start page before it runs. The frame found is the one checked, addressed
 * and reported. An action with no path lists no frames here and runs as before.
 */
async function runActionInFrame(
  action: BrowserActionCommand,
  startedAt: number,
  tabId: number,
  recordedFrameId: number | undefined
): Promise<BrowserActionRunResult> {
  const urlPath = frameUrlPathForAction(action);
  const choice = urlPath === undefined
    ? { frameId: recordedFrameId }
    : chooseFrame(await allTabFrames(tabId), recordedFrameId, urlPath);
  if ("refused" in choice) {
    return withTarget(workerActionResult(action, startedAt, choice.refused), tabId, recordedFrameId);
  }
  const frameId = choice.frameId;
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
  const message = { type: "executeAction", action, frameId: targetFrameId, topFrameOnly: frameId === undefined };
  const send = () => sendAction(action, tabId, message, targetFrameId);
  return withTarget(await sendClickCheckingLanding(action, tabId, send), tabId, targetFrameId);
}

/**
 * Chrome's words for a send that found no listener, and for a document that
 * unloaded before it answered: `executeAction` answers asynchronously
 * (`content/message-handler.ts`), so a navigation mid-action closes the channel.
 */
const NAVIGATING_PAGE_ERRORS = [/Receiving end does not exist/i, /message (port|channel) closed before a response was received/i];

/**
 * Sends the action, and a `web.dom.assert` once more when the first send met a
 * page that was navigating: `waitForTabReady` wants only a second of URL
 * stability, so a navigation a click started late can take the old document
 * away under the assert, which the router would report as a false
 * `web.action.failed`. Only the assert is re-sent, because it only reads: a
 * click or a type may already have acted before the channel closed, and sending
 * it again would act twice. A second refusal is reported as the first would be.
 *
 * A paginated `web.dom.extract_list` presses controls and reads, so it is
 * neither case: it is carried into each document its pagination loads by
 * `extract-list-continuation.ts`, which re-sends it only from a checkpoint the
 * page took before pressing anything.
 */
async function sendAction(
  action: BrowserActionCommand,
  tabId: number,
  message: Record<string, unknown>,
  frameId: number
): Promise<BrowserActionResult> {
  if (action.actionType === "web.dom.extract_list" && action.extractList?.paginate !== undefined) {
    return await sendExtractListAcrossDocuments(action, tabId, message, frameId, { send: sendToTab, makeReady: ensureContentScript });
  }
  try {
    return await sendToTab<BrowserActionResult>(tabId, message, frameId);
  } catch (error) {
    if (action.actionType !== "web.dom.assert" || !metNavigatingPage(error)) throw error;
    await waitForTabReady(tabId);
    return await sendToTab<BrowserActionResult>(tabId, message, frameId);
  }
}

function metNavigatingPage(error: unknown): boolean {
  return error instanceof Error && NAVIGATING_PAGE_ERRORS.some((pattern) => pattern.test(error.message));
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
