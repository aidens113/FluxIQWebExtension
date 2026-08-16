import type { TabDescriptor } from "../shared/protocol";

type MainWorldScriptInjection = {
  target: chrome.scripting.InjectionTarget;
  files: string[];
  world: "MAIN";
};

export async function activeTab(): Promise<TabDescriptor | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ? describeTab(tab) : undefined;
}

export async function allTabs(): Promise<TabDescriptor[]> {
  const tabs = await chrome.tabs.query({});
  return tabs.map(describeTab);
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
    await sendToTab(tabId, { type: "fluxiq.ping" });
    return;
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["page/event-listener-tracker.js"],
      world: "MAIN"
    } as MainWorldScriptInjection).catch(() => undefined);
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content/index.js"]
    });
  }
  await sendToTab(tabId, { type: "fluxiq.ping" });
}
