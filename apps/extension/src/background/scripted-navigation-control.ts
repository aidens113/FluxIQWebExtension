import { RUNTIME_MESSAGES } from "../shared/constants";
import type { FluxIQConnection } from "./connection";

type ControlResult = { readonly handled: false } | { readonly handled: true; readonly response: unknown };

function isControlPage(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id || typeof sender.url !== "string") return false;
  return sender.url === chrome.runtime.getURL("sidepanel/index.html")
    || sender.url === chrome.runtime.getURL("popup/index.html");
}

export async function handleScriptedNavigationControl(
  message: { readonly type?: string; readonly [key: string]: unknown },
  sender: chrome.runtime.MessageSender,
  manager: FluxIQConnection
): Promise<ControlResult> {
  const arm = message.type === RUNTIME_MESSAGES.testArmScriptedNavigation;
  const awaitIntent = message.type === RUNTIME_MESSAGES.testAwaitScriptedNavigation;
  const cancel = message.type === RUNTIME_MESSAGES.testCancelScriptedNavigation;
  if (!arm && !awaitIntent && !cancel) return { handled: false };

  if (!isControlPage(sender)) {
    return cancel
      ? { handled: true, response: { ok: true, cancelled: false } }
      : { handled: true, response: { ok: false, code: "forbidden" } };
  }
  if (arm) return { handled: true, response: manager.armScriptedNavigation(message.url) };
  if (awaitIntent) return { handled: true, response: await manager.awaitScriptedNavigation(message.intentId) };
  return { handled: true, response: { ok: true, cancelled: manager.cancelScriptedNavigation(message.intentId) } };
}
