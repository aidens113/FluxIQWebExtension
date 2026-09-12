// `web.browser.tab`: open a tab, switch to one, or close one.
//
// A tab action runs in the background worker, not the page: only the worker has
// `chrome.tabs`. Each operation leaves the automation tab pointing where the
// Flow now is, so the content action that follows addresses the tab this action
// selected rather than the one before it.

import type {
  BrowserActionCommand,
  BrowserActionResult,
  BrowserActionValidation,
  WebAutomationTabRequest
} from "../shared/protocol";
import {
  navigationUnexpectedFailure,
  workerActionFailedFailure,
  workerActionResult,
  workerBlockedFailure,
  workerTargetNotFoundFailure
} from "./action-results";
import {
  currentAutomationTabId,
  forgetAutomationTab,
  readTabUrl,
  setAutomationTab,
  tabIsOpen,
  waitForTabReady
} from "./automation-tab";
import { tabRequestForAction } from "./command-options";
import { compareNavigatedUrl } from "./navigation-outcome";

/** The fields of a browser tab a switch matches on, so the choice is testable without a browser. */
export type SwitchableTab = { id?: number | undefined; url?: string | undefined };

type OpenRequest = Extract<WebAutomationTabRequest, { operation: "open" }>;
type SwitchRequest = Extract<WebAutomationTabRequest, { operation: "switch" }>;
type CloseRequest = Extract<WebAutomationTabRequest, { operation: "close" }>;

export async function runBrowserTabAction(action: BrowserActionCommand): Promise<BrowserActionResult> {
  const startedAt = Date.now();
  const request = tabRequestForAction(action);
  if (request === undefined) {
    const expected = "operation open, switch, or close";
    return workerActionResult(action, startedAt, {
      status: "failed",
      message: "A tab action needs an operation of open, switch, or close.",
      validation: { status: "failed", expected, actual: "no operation" },
      failure: workerBlockedFailure("web.tab.invalid_request", { expected, actual: "no operation" })
    });
  }
  try {
    if (request.operation === "open") return await openTab(action, startedAt, request);
    if (request.operation === "switch") return await switchTab(action, startedAt, request);
    return await closeTab(action, startedAt, request);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "The browser refused the tab operation.";
    const expected = `tab ${request.operation} to succeed`;
    return workerActionResult(action, startedAt, {
      status: "failed",
      message: detail,
      validation: { status: "failed", expected, actual: detail },
      failure: workerActionFailedFailure("web.tab.failed", expected, detail)
    });
  }
}

/**
 * The tab a switch selects: the one with that id, else the first whose URL
 * contains the pattern. Nothing matches an absent id and an empty pattern --
 * switching to "any tab" would pick an arbitrary one.
 */
export function selectTabForSwitch(
  tabs: readonly SwitchableTab[],
  request: { tabId?: number | undefined; urlPattern?: string | undefined }
): SwitchableTab | undefined {
  if (request.tabId !== undefined) return tabs.find((tab) => tab.id === request.tabId);
  const pattern = request.urlPattern?.toLowerCase();
  if (pattern === undefined || pattern === "") return undefined;
  return tabs.find((tab) => (tab.url ?? "").toLowerCase().includes(pattern));
}

async function openTab(action: BrowserActionCommand, startedAt: number, request: OpenRequest): Promise<BrowserActionResult> {
  const created = await chrome.tabs.create({
    ...(request.url !== undefined ? { url: request.url } : {}),
    active: request.active ?? true
  });
  const tabId = created.id;
  if (tabId === undefined) {
    return workerActionResult(action, startedAt, {
      status: "failed",
      message: "The browser opened a tab without an id.",
      validation: { status: "failed", expected: "a new tab", actual: "a tab with no id" },
      failure: workerActionFailedFailure("web.tab.no_id", "a new tab", "a tab with no id")
    });
  }
  setAutomationTab(tabId);
  if (request.url !== undefined) await waitForTabReady(tabId);
  const landed = await readTabUrl(tabId);
  if (request.url === undefined) {
    return workerActionResult(action, startedAt, {
      status: "succeeded",
      message: `Opened tab ${tabId}.`,
      validation: { status: "passed", expected: "a new tab", actual: `tab ${tabId} at ${landed ?? "about:blank"}` },
      ...(landed !== undefined ? { url: landed } : {})
    });
  }
  const comparison = compareNavigatedUrl(request.url, landed);
  const validation: BrowserActionValidation = comparison.matched
    ? { status: "passed", expected: comparison.expected, actual: comparison.actual }
    : { status: "failed", expected: comparison.expected, actual: comparison.actual };
  return workerActionResult(action, startedAt, {
    status: comparison.matched ? "succeeded" : "failed",
    message: comparison.matched
      ? `Opened tab ${tabId} at ${comparison.actual}.`
      : `Tab ${tabId} opened at ${comparison.actual}, not ${comparison.expected}.`,
    validation,
    ...(comparison.matched ? {} : { failure: navigationUnexpectedFailure(comparison.expected, comparison.actual) }),
    ...(landed !== undefined ? { url: landed } : {})
  });
}

async function switchTab(action: BrowserActionCommand, startedAt: number, request: SwitchRequest): Promise<BrowserActionResult> {
  const expected = request.tabId !== undefined
    ? `tab ${request.tabId} active`
    : `a tab whose URL contains "${request.urlPattern ?? ""}" active`;
  const match = selectTabForSwitch(await chrome.tabs.query({}), request);
  const tabId = match?.id;
  if (tabId === undefined) {
    const actual = "no open tab matched";
    return workerActionResult(action, startedAt, {
      status: "failed",
      message: "No open tab matched the switch request.",
      validation: { status: "failed", expected, actual },
      failure: workerTargetNotFoundFailure("web.tab.no_match", expected, actual)
    });
  }
  await chrome.tabs.update(tabId, { active: true });
  setAutomationTab(tabId);
  const landed = await readTabUrl(tabId);
  return workerActionResult(action, startedAt, {
    status: "succeeded",
    message: `Switched to tab ${tabId}.`,
    validation: { status: "passed", expected, actual: `tab ${tabId} at ${landed ?? "(unknown)"}` },
    ...(landed !== undefined ? { url: landed } : {})
  });
}

async function closeTab(action: BrowserActionCommand, startedAt: number, request: CloseRequest): Promise<BrowserActionResult> {
  const tabId = request.tabId ?? currentAutomationTabId();
  if (tabId === undefined) {
    const expected = "a tab to close";
    return workerActionResult(action, startedAt, {
      status: "failed",
      message: "No tab was named and FluxIQ is not driving one.",
      validation: { status: "failed", expected, actual: "no tab named and none open" },
      failure: workerBlockedFailure("web.tab.no_target", { expected, actual: "no tab named and none open" })
    });
  }
  await chrome.tabs.remove(tabId);
  forgetAutomationTab(tabId);
  const stillOpen = await tabIsOpen(tabId);
  const expected = `tab ${tabId} closed`;
  const actual = stillOpen ? `tab ${tabId} is still open` : `tab ${tabId} closed`;
  if (stillOpen) {
    return workerActionResult(action, startedAt, {
      status: "failed",
      message: `Tab ${tabId} is still open.`,
      validation: { status: "failed", expected, actual },
      failure: workerActionFailedFailure("web.tab.not_closed", expected, actual)
    });
  }
  return workerActionResult(action, startedAt, {
    status: "succeeded",
    message: `Closed tab ${tabId}.`,
    validation: { status: "passed", expected, actual }
  });
}
