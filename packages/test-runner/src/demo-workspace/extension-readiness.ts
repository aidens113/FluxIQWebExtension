// Opening the extension's control page only once its background answers.
//
// Measured on 2026-09-29 on a loaded machine: of eight fresh Chromium launches
// with the unpacked extension, three never showed its service worker to
// Playwright within 30 s, and the ui:e2e run's extraction journey opened a
// control page whose background never answered at all -- the page sat on
// "Checking the connection..." and "State: unknown", and Save hung on
// "Saving..." until the step's 30 s wait ran out. Opening the page and then
// asking the background for its status, reopening the page when it does not
// answer, is what wakes an MV3 service worker; this makes that the lane's
// entry condition instead of a race the journey loses much later.

import { realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import type { BrowserContext, Page } from "@playwright/test";
import { RunnerFailure } from "../failure.js";

/** How long a lane waits, in all, for the extension's background to answer its control page. */
export const EXTENSION_READY_TIMEOUT_MS = 90_000;
/** How long one status request may go unanswered before the page is reopened. */
const STATUS_ANSWER_TIMEOUT_MS = 5_000;
/** How long the service worker gets to appear before the id is derived from the extension's path instead. */
const SERVICE_WORKER_WAIT_MS = 15_000;

/**
 * Chromium's id for an unpacked extension: the first 32 hex digits of the
 * SHA-256 of its absolute path, each mapped onto `a`-`p`. Windows hashes the
 * path's UTF-16LE bytes, other platforms its UTF-8 bytes. Measured to match the
 * service worker's host on Windows for a real (`realpath`) path.
 */
export function unpackedExtensionId(extensionPath: string, platform: NodeJS.Platform = process.platform): string {
  const bytes = Buffer.from(extensionPath, platform === "win32" ? "utf16le" : "utf8");
  return [...createHash("sha256").update(bytes).digest("hex").slice(0, 32)].map((digit) => String.fromCharCode(97 + Number.parseInt(digit, 16))).join("");
}

/**
 * Navigates `page` to the extension's side panel and returns its URL once the
 * background has answered a status request. The id comes from the running
 * service worker, or from the extension's path when none appears. A page whose
 * background stays silent is reopened, up to `timeoutMs` in all; after that
 * the lane fails `extension.worker` with a closed reason code, before it has
 * spent anything on a journey.
 */
export async function openResponsiveExtensionPage(context: BrowserContext, page: Page, extensionPath: string, timeoutMs = EXTENSION_READY_TIMEOUT_MS): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: SERVICE_WORKER_WAIT_MS }).catch((error: unknown) => {
    if (error instanceof Error && error.name === "TimeoutError") return undefined;
    throw error;
  });
  const extensionId = worker ? new URL(worker.url()).hostname : unpackedExtensionId(realpathSync.native(path.resolve(extensionPath)));
  const url = "chrome-extension://" + extensionId + "/sidepanel/index.html";
  let attempts = 0;
  while (Date.now() < deadline) {
    attempts += 1;
    await page.goto(url);
    if (await backgroundAnswers(page)) return url;
  }
  throw new RunnerFailure("extension.worker", "The extension's background never answered its control page", { details: { reasonCode: "extension.background_unresponsive", attempts, workerSeen: worker !== undefined } });
}

/**
 * Whether the background answers one status request in time. A refused
 * message ("Receiving end does not exist") is a background that did not
 * answer, which is exactly what reopening the page is for.
 */
async function backgroundAnswers(page: Page): Promise<boolean> {
  const answer = page.evaluate(() => (globalThis as any).chrome.runtime.sendMessage({ type: "fluxiq.getStatus" }).then((response: any) => response?.ok === true, () => false));
  const timer = new Promise<false>((resolve) => setTimeout(() => resolve(false), STATUS_ANSWER_TIMEOUT_MS));
  return await Promise.race([answer, timer]);
}
