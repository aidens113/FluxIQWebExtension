import { setTimeout as delay } from "node:timers/promises";
import type { Page } from "playwright-core";
import { BrowserHostError } from "../errors/index.js";
import { readStatus } from "./read-status.js";
import { sendExtensionMessage } from "./send-extension-message.js";

export type EnrolRequest = {
  gatewayUrl: string;
  coreApiUrl: string;
  /** Absent: connect with the token the profile already stores. */
  ticket?: string | undefined;
  /** How long to wait for the connection to settle. */
  timeoutMs: number;
};

export type EnrolOutcome =
  | { state: "connected"; sessionId: string }
  /** The gateway refused the ticket (`enrolment.*`); a new ticket would not help. */
  | { state: "refused"; code: string }
  | { state: "timeout"; connectionState: string; lastError: string | undefined };

const STATUS_POLL_MS = 250;

/**
 * Tells the extension to connect, carrying the ticket when there is one, then
 * watches its status until it is connected, the gateway refuses the ticket, or
 * `timeoutMs` passes. The ticket goes only into the message to the extension's
 * background; nothing here records or returns it.
 */
export async function enrolExtension(page: Page, request: EnrolRequest): Promise<EnrolOutcome> {
  const message = { type: "fluxiq.connect", settings: { gatewayUrl: request.gatewayUrl, coreApiUrl: request.coreApiUrl }, ...(request.ticket === undefined ? {} : { enrolment: { ticket: request.ticket } }) };
  const reply = (await sendExtensionMessage(page, message)) as { ok?: boolean; code?: string } | undefined;
  if (reply?.ok === false) throw new BrowserHostError("browser_host.connect_refused", `The extension refused the connect message (${reply.code ?? "no code"}).`);
  const end = Date.now() + request.timeoutMs;
  for (;;) {
    const status = await readStatus(page);
    if (status.connectionState === "connected" && status.sessionId !== undefined) return { state: "connected", sessionId: status.sessionId };
    // The extension names Core's refusal code (`enrolment.*`) in its status; the error text is for people.
    if (status.enrolmentRefusalCode !== undefined) return { state: "refused", code: status.enrolmentRefusalCode };
    if (Date.now() >= end) return { state: "timeout", connectionState: status.connectionState, lastError: status.lastError };
    await delay(STATUS_POLL_MS);
  }
}
