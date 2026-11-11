import type { FluxIQHostLaunchRequest, FluxIQLaunchedHost } from "fluxiq/server";
import { chromium, type BrowserContext, type Worker } from "playwright-core";
import type { BrowserHostOptions } from "./browser-host-options.js";
import { cleanEnvironment } from "./clean-environment.js";
import { connectHost } from "./connect-host.js";
import { extensionIdOf, openControlPage } from "./enrol/index.js";
import { BrowserHostError } from "./errors/index.js";
import { assertProtocolLoggingOff } from "./guards/index.js";
import { createFreshProfile, createNamedProfile, removeProfile } from "./profile/index.js";
import { releaseProfile, sharedReaper } from "./reaper/index.js";

const WORKER_WAIT_MS = 30_000;

/**
 * Launches one managed browser host: Chromium on its own profile with the built
 * extension, enrolled with the engine through a one-time ticket that goes to the
 * extension's background in memory only. Any failure after the browser starts
 * closes it and its profile before the error is thrown.
 */
export async function launchHost(request: FluxIQHostLaunchRequest, options: BrowserHostOptions): Promise<FluxIQLaunchedHost> {
  assertProtocolLoggingOff();
  if (request.signal.aborted) throw new BrowserHostError("browser_host.aborted", `Host ${request.hostId} was not started: the engine is stopping.`, { hostId: request.hostId });
  const fresh = request.profile.kind === "fresh";
  const profileDir = request.profile.kind === "fresh" ? await createFreshProfile(request.hostId) : await createNamedProfile(request.dataDir, request.profile.name, request.hostId);
  const reaper = sharedReaper();
  await reaper.register(profileDir, fresh);

  let context: BrowserContext | undefined;
  let settleClosed: () => void = () => undefined;
  const closed = new Promise<void>(resolve => { settleClosed = resolve; });
  let closing: Promise<void> | undefined;
  const close = (): Promise<void> => (closing ??= (async () => {
    try {
      await context?.close().catch(/* best-effort: a browser that already died */ () => undefined);
      await releaseProfile(profileDir);
      if (fresh) await removeProfile(profileDir);
      await reaper.forget(profileDir);
    } finally {
      settleClosed();
    }
  })());

  try {
    const headless = options.headless ?? request.headless;
    context = await chromium.launchPersistentContext(profileDir, {
      headless,
      ...(headless && options.executablePath === undefined ? { channel: "chromium" } : {}),
      ...(options.executablePath === undefined ? {} : { executablePath: options.executablePath }),
      env: cleanEnvironment(),
      args: [`--disable-extensions-except=${options.extensionPath}`, `--load-extension=${options.extensionPath}`, "--no-first-run", "--disable-default-apps", ...(options.browserArgs ?? [])]
    });
    context.on("close", () => void close().catch(reportCloseFailure));
    request.signal.addEventListener("abort", () => void close().catch(reportCloseFailure), { once: true });
    await options.onContext?.(context);
    const worker = await extensionWorker(context);
    const page = await openControlPage(context, extensionIdOf(worker.url()));
    await connectHost(page, request, options, () => closing !== undefined);
    await page.close();
  } catch (error) {
    await close().catch(reportCloseFailure);
    throw error instanceof BrowserHostError ? error : new BrowserHostError("browser_host.launch_failed", `Host ${request.hostId} could not be launched: ${(error as Error).message.split("\n")[0] ?? "failed"}`, { hostId: request.hostId, cause: error });
  }
  return { hostId: request.hostId, close, closed };
}

/** A close that fails cannot be thrown from an event; the reaper still holds the profile, so say so and carry on. */
function reportCloseFailure(error: unknown): void {
  process.stderr.write(`browser-host: closing a host failed: ${(error as Error).message}
`);
}

async function extensionWorker(context: BrowserContext): Promise<Worker> {
  const isExtension = (worker: Worker): boolean => worker.url().startsWith("chrome-extension://");
  return context.serviceWorkers().find(isExtension) ?? context.waitForEvent("serviceworker", { predicate: isExtension, timeout: WORKER_WAIT_MS });
}
