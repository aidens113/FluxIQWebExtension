import type { TabDescriptor } from "../shared/protocol";

const REQUIRED_CONTENT_SCRIPT_VERSION = 2;

/** The id the browser always gives a tab's main frame; every child frame has a positive one. */
const TOP_FRAME_ID = 0;

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

/**
 * Makes one frame of a tab ready to answer: pings it, and reinjects when the
 * answer is missing or comes from a superseded version of the script.
 *
 * The frame defaults to the top one, which is what every caller that names a
 * whole tab means. Only that frame is ever recovered by default, because a
 * single inaccessible child (an `about:blank` frame, or a cross-origin one the
 * manifest does not cover) must not prevent recovery of the top-frame script
 * used by default actions. Manifest-declared content scripts still cover
 * eligible descendants -- until an extension reload or update, which leaves
 * every already-loaded frame without a script while the frames themselves
 * survive. That is why a caller addressing a child frame has to name it: the
 * frame is there, the declarative injection has already happened, and nothing
 * in it is listening.
 *
 * Throws when the frame cannot be made ready. `unreachableFrameReason` is the
 * non-throwing form, for a caller that has to turn that into a failure record
 * rather than an exception.
 */
export async function ensureContentScript(tabId: number, frameId: number = TOP_FRAME_ID): Promise<void> {
  try {
    const response = await sendToTab<{ ok?: boolean; active?: boolean; version?: number }>(tabId, { type: "fluxiq.ping" }, frameId);
    if (response.ok === true && response.version === REQUIRED_CONTENT_SCRIPT_VERSION) return;
  } catch {
    // Reinject below.
  }
  await chrome.scripting.executeScript({
    target: { tabId, frameIds: [frameId] },
    files: ["content/index.js"]
  });
  const response = await sendToTab<{ ok?: boolean; version?: number }>(tabId, { type: "fluxiq.ping" }, frameId);
  if (response.ok !== true || response.version !== REQUIRED_CONTENT_SCRIPT_VERSION) {
    throw new Error(`FluxIQ content script did not become ready in ${frameDescription(frameId)}.`);
  }
}

/**
 * Why the frame cannot answer a command, or `undefined` once it can.
 *
 * A command sent to a frame with no listener is never answered and never
 * refused -- `chrome.tabs.sendMessage` resolves nothing and no deadline is
 * applied to a web action anywhere upstream -- so the caller needs the reason
 * as a value it can classify, not as a throw it would have to flatten into a
 * sentence. The wording is written to read as the `actual` half of a failure
 * record's comparison.
 */
export async function unreachableFrameReason(tabId: number, frameId: number): Promise<string | undefined> {
  try {
    await ensureContentScript(tabId, frameId);
    return undefined;
  } catch (error) {
    const detail = error instanceof Error ? error.message.trim() : "";
    return detail || `${frameDescription(frameId)} did not answer.`;
  }
}

/** How a frame is named in a message a person reads. */
function frameDescription(frameId: number): string {
  return frameId === TOP_FRAME_ID ? "the top frame" : `frame ${frameId}`;
}
