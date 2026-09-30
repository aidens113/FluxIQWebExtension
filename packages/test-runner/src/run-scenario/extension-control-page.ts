// Starting the extension for a run: its service worker, then its control page,
// once more if the page's renderer crashed or its navigation was aborted.
//
// Two live runs on 2026-09-29 (`run-muna3yfq-a7d8a2a0`, `run-munbu244-4f4021a8`)
// ended before their build with `page.goto: Page crashed` on
// `sidepanel/index.html`, while the machine had about 3 GB of commit free and
// other lanes' browsers running. The run between them loaded the same page
// cleanly. A renderer that died loading a static extension page says nothing
// about the product, and the run spent no provider call yet, so the page is
// opened again in a fresh tab, once. Live run 12 then died 11 s in on
// `net::ERR_ABORTED; maybe frame was detached?` for the same page, which is
// the same class of fault -- the tab went away under the navigation -- and is
// retried the same way after a short pause. A second failure still ends the
// run, now as an `extension.worker` failure whose details say which stage
// failed, how many attempts were made, why each retried one was closed, and
// how long the worker and the page took: codes and integers, never the
// browser's message, which stays on the failure's message and cause.
import type { BrowserContext, Page } from "@playwright/test";
import { RunnerFailure } from "../failure.js";
import { awaitExtensionWorker } from "../run-lifecycle/index.js";

const RENDERER_CRASH = /\b(?:Page|Target) crashed\b/u;
const NAVIGATION_ABORTED = /net::ERR_ABORTED|frame was detached/iu;
const RETRY_DELAY_MS = 1_000;

/** Why a control-page attempt was closed. `navigation_failed` is never retried. */
export type ExtensionControlPageReason = "renderer_crash" | "navigation_aborted" | "navigation_failed";
/** How many times the control page was opened before it loaded, and why each earlier tab was closed. One attempt is the ordinary case. */
export type ExtensionControlPageOpen = { page: Page; attempts: number; retried: ExtensionControlPageReason[] };
export type ExtensionControlPageOptions = { maxAttempts?: number; retryDelayMs?: number; sleep?: (ms: number) => Promise<void>; now?: () => number };
type ExtensionControlContext = Pick<BrowserContext, "newPage"> & Parameters<typeof awaitExtensionWorker>[0];

export async function openExtensionControlPage(context: Pick<BrowserContext, "newPage">, url: string, options: ExtensionControlPageOptions = {}): Promise<ExtensionControlPageOpen> {
  const maxAttempts = options.maxAttempts ?? 2;
  const retryDelayMs = options.retryDelayMs ?? RETRY_DELAY_MS;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>(resolve => { setTimeout(resolve, ms); }));
  const now = options.now ?? Date.now;
  const startedAt = now();
  const retried: ExtensionControlPageReason[] = [];
  for (let attempt = 1; ; attempt += 1) {
    const page = await context.newPage();
    try {
      await page.goto(url);
      return { page, attempts: attempt, retried };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const reason = controlPageReason(message);
      if (reason === "navigation_failed" || attempt >= maxAttempts) {
        throw new RunnerFailure("extension.worker", `The extension's control page did not load after ${attempt} attempt(s) (${reason}): ${message}`, {
          cause: error,
          details: { extensionStage: "control-page", attempts: attempt, retried: [...retried], reason, waitedMs: Math.max(0, now() - startedAt) },
        });
      }
      retried.push(reason);
      await page.close().catch(/* best-effort: a crashed or detached tab may already be gone */ () => undefined);
      if (reason === "navigation_aborted") await sleep(retryDelayMs);
    }
  }
}

/**
 * Waits for the extension's service worker, then opens its control page, timing both so a failure says where the start stopped.
 *
 * A retried page means the extension's renderer went away under the first one, and the worker lives in that renderer. On
 * Chromium 134 under Playwright the worker was then not started again (t174-w7, 9 of 10 starts): the retried page loaded, and
 * every runtime message to the dead worker went unanswered until pairing timed out 15 s later as `connectionState: unreported`.
 * So after a retry the worker is woken with one runtime message and must be present again, or the start fails here, at the
 * worker stage, naming the retry that preceded it.
 */
export async function extensionControlPage(context: ExtensionControlContext, options: ExtensionControlPageOptions & { awaitWorker?: typeof awaitExtensionWorker; wakeWorker?: (page: Page) => Promise<unknown> } = {}): Promise<Page> {
  const now = options.now ?? Date.now;
  const awaitWorker = options.awaitWorker ?? awaitExtensionWorker;
  const workerStartedAt = now();
  let worker: Awaited<ReturnType<typeof awaitExtensionWorker>>;
  try {
    worker = await awaitWorker(context);
  } catch (error) {
    if (!(error instanceof RunnerFailure) || error.category !== "extension.worker") throw error;
    throw new RunnerFailure(error.category, error.message, { cause: error, details: { ...error.details, extensionStage: "worker", workerMs: Math.max(0, now() - workerStartedAt) } });
  }
  const workerMs = Math.max(0, now() - workerStartedAt);
  const id = new URL(worker.url()).hostname;
  const openStartedAt = now();
  let opened: ExtensionControlPageOpen;
  try {
    opened = await openExtensionControlPage(context, `chrome-extension://${id}/sidepanel/index.html`, options);
  } catch (error) {
    if (!(error instanceof RunnerFailure) || error.category !== "extension.worker") throw error;
    throw new RunnerFailure(error.category, error.message, { cause: error.cause ?? error, details: { ...error.details, workerMs, openMs: Math.max(0, now() - openStartedAt) } });
  }
  if (opened.retried.length === 0) return opened.page;
  const wake = options.wakeWorker ?? wakeExtensionWorker;
  void wake(opened.page).catch(/* best-effort: the wake only dispatches an event; whether the worker came back is what awaitWorker below decides */ () => undefined);
  const recheckStartedAt = now();
  try {
    await awaitWorker(context);
  } catch (error) {
    if (!(error instanceof RunnerFailure) || error.category !== "extension.worker") throw error;
    throw new RunnerFailure(error.category, `The extension's service worker did not come back after its control page was retried (${opened.retried.join(", ")}): ${error.message}`, { cause: error, details: { ...error.details, extensionStage: "worker", workerMs: Math.max(0, now() - recheckStartedAt), afterRetried: [...opened.retried] } });
  }
  return opened.page;
}

/** One runtime message from the extension's own page: the event that starts a stopped worker. */
function wakeExtensionWorker(page: Page): Promise<unknown> {
  return page.evaluate(() => (globalThis as { chrome?: { runtime?: { sendMessage(message: unknown): Promise<unknown> } } }).chrome?.runtime?.sendMessage({ type: "fluxiq.getStatus" }));
}

/** Selects only the extension start's closed diagnostic projection for a run-bundle event. */
export function extensionStartFailureDetails(error: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!(error instanceof RunnerFailure) || error.category !== "extension.worker") return undefined;
  const details = error.details;
  if (details?.extensionStage === "control-page") {
    const retried = details.retried;
    if (!count(details.attempts) || !Array.isArray(retried) || !retried.every(item => item === "renderer_crash" || item === "navigation_aborted") || !REASONS.has(details.reason) || !count(details.waitedMs) || !count(details.workerMs) || !count(details.openMs)) return undefined;
    return { extensionStage: "control-page", attempts: details.attempts, retried: [...retried], reason: details.reason, waitedMs: details.waitedMs, workerMs: details.workerMs, openMs: details.openMs };
  }
  if (details?.extensionStage === "worker") {
    if (!count(details.workerMs) || !count(details.timeoutMs) || !count(details.observedWorkerCount) || typeof details.browserConnected !== "boolean") return undefined;
    const afterRetried = details.afterRetried;
    if (afterRetried !== undefined && !(Array.isArray(afterRetried) && afterRetried.length > 0 && afterRetried.every(item => item === "renderer_crash" || item === "navigation_aborted"))) return undefined;
    return { extensionStage: "worker", workerMs: details.workerMs, timeoutMs: details.timeoutMs, observedWorkerCount: details.observedWorkerCount, browserConnected: details.browserConnected, ...(afterRetried === undefined ? {} : { afterRetried: [...afterRetried] }) };
  }
  return undefined;
}

const REASONS = new Set<unknown>(["renderer_crash", "navigation_aborted", "navigation_failed"]);

function controlPageReason(message: string): ExtensionControlPageReason {
  if (RENDERER_CRASH.test(message)) return "renderer_crash";
  if (NAVIGATION_ABORTED.test(message)) return "navigation_aborted";
  return "navigation_failed";
}

function count(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
