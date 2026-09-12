// The parameters of an action that only the background worker can act on.
//
// `webAutomationActionFromGatewayCommand` maps a fixed set of flat fields and
// copies every remaining parameter verbatim into `options`, so a tab request, a
// download request, `newTab`, and the frame a Flow addresses arrive there until
// the domain mapping grows typed fields for them. Each reader takes either
// shape -- the typed field first, the raw parameter second -- and refuses a
// malformed value rather than coercing it, so a bad parameter fails the action
// instead of silently retargeting it at another tab or frame.

import type {
  BrowserActionCommand,
  WebAutomationDownloadRequest,
  WebAutomationTabRequest
} from "../shared/protocol";

function optionsOf(action: BrowserActionCommand): Record<string, unknown> {
  return (action.options ?? {}) as Record<string, unknown>;
}

/** A tab or frame id: a non-negative safe integer, or nothing. `0` is the top frame, so it must survive. */
function integerAt(options: Record<string, unknown>, key: string): number | undefined {
  const value = options[key];
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function stringAt(options: Record<string, unknown>, key: string): string | undefined {
  const value = options[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function booleanAt(options: Record<string, unknown>, key: string): boolean | undefined {
  const value = options[key];
  return typeof value === "boolean" ? value : undefined;
}

/**
 * The frame an action runs in. Undefined means the top frame only: the runner
 * sends `topFrameOnly` so a page of iframes cannot answer from whichever frame
 * replies first.
 */
export function frameIdForAction(action: BrowserActionCommand): number | undefined {
  return action.frameId ?? integerAt(optionsOf(action), "browserFrameId");
}

/** The tab an action names, if it names one. Without it the runner picks the automation or active tab. */
export function tabIdForAction(action: BrowserActionCommand): number | undefined {
  return action.tabId ?? integerAt(optionsOf(action), "browserTabId");
}

/** `web.browser.navigate`: open a new tab instead of reusing the automation tab. */
export function opensNewTab(action: BrowserActionCommand): boolean {
  return action.newTab ?? booleanAt(optionsOf(action), "newTab") ?? false;
}

/**
 * The tab operation `web.browser.tab` was asked for, or undefined when the
 * command names none. `url` and `tabId` are read from the command's own fields
 * first, because the gateway mapping already lifts `parameters.url` there.
 */
export function tabRequestForAction(action: BrowserActionCommand): WebAutomationTabRequest | undefined {
  if (action.tab !== undefined) return action.tab;
  const options = optionsOf(action);
  const operation = stringAt(options, "operation");
  const url = action.url ?? stringAt(options, "url");
  const tabId = action.tabId ?? integerAt(options, "tabId");
  const urlPattern = stringAt(options, "urlPattern");
  const active = booleanAt(options, "active");
  if (operation === "open") {
    return { operation: "open", ...(url !== undefined ? { url } : {}), ...(active !== undefined ? { active } : {}) };
  }
  if (operation === "switch") {
    return { operation: "switch", ...(tabId !== undefined ? { tabId } : {}), ...(urlPattern !== undefined ? { urlPattern } : {}) };
  }
  if (operation === "close") {
    return { operation: "close", ...(tabId !== undefined ? { tabId } : {}) };
  }
  return undefined;
}

/**
 * What `web.browser.download` waits for. Every field is optional -- waiting for
 * any download to finish is a legitimate request -- so this always yields a
 * request, never undefined.
 */
export function downloadRequestForAction(action: BrowserActionCommand): WebAutomationDownloadRequest {
  const options = optionsOf(action);
  const filename = action.download?.filename ?? stringAt(options, "filename");
  const timeoutMs = action.download?.timeoutMs ?? action.timeoutMs ?? integerAt(options, "timeoutMs");
  return {
    ...(filename !== undefined ? { filename } : {}),
    ...(timeoutMs !== undefined ? { timeoutMs } : {})
  };
}
