import { BUILD_IDENTITY_MESSAGE, currentBuildIdentity } from "../../shared/build-identity";
import { isControlPage } from "../control-page";

/** No gateway, settings, token, page contents or provider calls enter this diagnostic. */
export async function readBuildIdentity(message: { tabId?: unknown }, sender: chrome.runtime.MessageSender): Promise<unknown> {
  if (!isControlPage(sender)) return { ok: false, code: "forbidden" };
  if (!Number.isSafeInteger(message.tabId) || (message.tabId as number) < 0) return { ok: false, code: "invalid_tab" };
  const content = await chrome.tabs.sendMessage(message.tabId as number, { type: BUILD_IDENTITY_MESSAGE }, { frameId: 0 });
  return { ok: true, background: currentBuildIdentity(), content };
}
