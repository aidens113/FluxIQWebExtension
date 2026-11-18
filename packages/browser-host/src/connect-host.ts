import type { FluxIQHostLaunchRequest } from "fluxiq/server";
import type { Page } from "playwright-core";
import type { BrowserHostOptions } from "./browser-host-options.js";
import { enrolExtension, redactTicket } from "./enrol/index.js";
import { BrowserHostError } from "./errors/index.js";

const ATTEMPTS = 4; // the first attempt plus 3 retries
const DEFAULT_CONNECT_TIMEOUT_MS = 30_000;

/**
 * Brings the extension to a connected gateway session.
 *
 * A named profile first connects without a ticket, since the token it stored
 * resumes. Otherwise a ticket is taken for each attempt: a connect that fails
 * before redemption (transport, a socket dropped before the session was ready)
 * is retried with a new one, the first attempt plus 3 retries, each cause
 * kept. An `enrolment.*` refusal is final and reported as is.
 */
export async function connectHost(page: Page, request: FluxIQHostLaunchRequest, options: BrowserHostOptions, isClosed: () => boolean): Promise<void> {
  const base = { gatewayUrl: request.gatewayUrl, coreApiUrl: request.coreApiUrl, timeoutMs: options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS };
  if (request.profile.kind === "named" && (await enrolExtension(page, base)).state === "connected") return;
  const causes: string[] = [];
  for (let attempt = 1; attempt <= ATTEMPTS && !isClosed() && !request.signal.aborted; attempt++) {
    try {
      const outcome = await enrolExtension(page, { ...base, ticket: request.takeEnrolmentTicket() });
      if (outcome.state === "connected") return;
      if (outcome.state === "refused") throw new BrowserHostError(outcome.code, `The gateway refused host ${request.hostId}'s enrolment (${outcome.code}).`, { hostId: request.hostId });
      causes.push(`attempt ${attempt}: ${outcome.connectionState}${outcome.lastError === undefined ? "" : ` (${redactTicket(outcome.lastError)})`}`);
    } catch (error) {
      if (error instanceof BrowserHostError) throw error;
      causes.push(`attempt ${attempt}: ${redactTicket((error as Error).message.split("\n")[0] ?? "failed")}`);
    }
  }
  throw new BrowserHostError("browser_host.connect_failed", `Host ${request.hostId} did not connect to the gateway: ${causes.join("; ") || "closed first"}.`, { hostId: request.hostId });
}
