import type { Page } from "playwright-core";

type RuntimeWindow = { chrome: { runtime: { sendMessage(message: unknown): Promise<unknown> } } };

/** Sends one message to the extension's background from its control page and returns the reply. The message is an argument to `evaluate`, so it can carry the ticket: it exists only in memory, over the browser pipe. */
export function sendExtensionMessage(page: Page, message: unknown): Promise<unknown> {
  return page.evaluate(input => (globalThis as unknown as RuntimeWindow).chrome.runtime.sendMessage(input), message);
}
