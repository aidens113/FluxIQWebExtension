import type { TabDescriptor } from "../shared/protocol";

const REQUIRED_CONTENT_SCRIPT_VERSION = 2;

export async function activeTab(): Promise<TabDescriptor | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ? describeTab(tab) : undefined;
}

export async function allTabs(): Promise<TabDescriptor[]> {
  const tabs = await chrome.tabs.query({});
  return tabs.map(describeTab);
}

export async function allTabFrames(tabId: number): Promise<chrome.webNavigation.GetAllFrameResultDetails[]> {
  return new Promise((resolve) => {
    chrome.webNavigation.getAllFrames({ tabId }, (frames) => {
      const error = chrome.runtime.lastError;
      if (error || !frames) resolve([]);
      else resolve(frames);
    });
  });
}

export function describeTab(tab: chrome.tabs.Tab): TabDescriptor {
  const descriptor: TabDescriptor = {
    tabId: tab.id ?? -1
  };
  if (tab.windowId !== undefined) descriptor.windowId = tab.windowId;
  if (tab.url) descriptor.url = tab.url;
  if (tab.title) descriptor.title = tab.title;
  if (tab.favIconUrl) descriptor.favIconUrl = tab.favIconUrl;
  if (tab.active !== undefined) descriptor.active = tab.active;
  if (tab.status) descriptor.status = tab.status;
  return descriptor;
}

export async function sendToTab<TResponse = unknown>(tabId: number, message: unknown, frameId?: number): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    const callback = (response: unknown) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(response as TResponse);
    };
    if (frameId !== undefined) chrome.tabs.sendMessage(tabId, message, { frameId }, callback);
    else chrome.tabs.sendMessage(tabId, message, callback);
  });
}

export async function ensureContentScript(tabId: number): Promise<void> {
  try {
    const response = await sendToTab<{ ok?: boolean; active?: boolean; version?: number }>(tabId, { type: "fluxiq.ping" }, 0);
    if (response.ok === true && response.version === REQUIRED_CONTENT_SCRIPT_VERSION) return;
  } catch {
    // Reinject below.
  }
  await chrome.scripting.executeScript({
    // A single inaccessible child (including an about:blank frame) must not
    // prevent recovery of the top-frame script used by default actions.
    // Manifest-declared content scripts still cover eligible descendants.
    target: { tabId, frameIds: [0] },
    files: ["content/index.js"]
  });
  const response = await sendToTab<{ ok?: boolean; version?: number }>(tabId, { type: "fluxiq.ping" }, 0);
  if (response.ok !== true || response.version !== REQUIRED_CONTENT_SCRIPT_VERSION) {
    throw new Error("FluxIQ content script did not become ready in the top frame.");
  }
}
