import type { Page } from "playwright-core";
import type { ExtensionConnection } from "./extension-connection.js";
import { sendExtensionMessage } from "./send-extension-message.js";

/** The extension's connection status (`fluxiq.getStatus`). */
export async function readStatus(page: Page): Promise<ExtensionConnection> {
  const reply = (await sendExtensionMessage(page, { type: "fluxiq.getStatus" })) as { status?: Record<string, unknown> } | undefined;
  const status = reply?.status ?? {};
  return {
    connectionState: typeof status["connectionState"] === "string" ? status["connectionState"] : "unknown",
    sessionId: typeof status["sessionId"] === "string" ? status["sessionId"] : undefined,
    lastError: typeof status["lastError"] === "string" ? status["lastError"] : undefined,
    enrolmentRefusalCode: typeof status["enrolmentRefusalCode"] === "string" ? status["enrolmentRefusalCode"] : undefined
  };
}
