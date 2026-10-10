// Matrix row 11's fault: the extension's service worker stops mid-action.
//
// The trigger is the fixture site's own request: the first time a page sends
// a request matching `onSiteRequest` to one of the run's scenario origins --
// the request a committing act causes, such as social-network-feed's
// `POST /api/social-network-feed/confirm-request` -- the extension's
// `service_worker` CDP target is closed (`Target.closeTarget`, the call behind
// Puppeteer's `worker.close()` that Chrome's own extension docs use to test
// worker termination). The act lands on the site while the worker that would
// report it is gone; its gateway socket goes with it.
//
// Chrome starts the worker again on the extension's next event. What happened
// to the worker afterwards is read from Chrome's target list, polled, rather
// than from events: in the headed checks neither Playwright's worker `close` /
// `serviceworker` events nor CDP's target discovery events arrived on the
// control page's session for the stopped worker or its successor. The stopped
// target leaving the list is `worker.gone`; an extension worker listed after
// that is `worker.started` (headed, Chromium 134 listed the successor under
// the stopped worker's own target id). The network guard proves the successor like any new
// worker (`network-guard.ts`).

import type { BrowserContext, CDPSession, Page, Request } from "@playwright/test";
import type { PerturbationLog } from "./perturbation-log.js";
import { siteRequestMatcher } from "./site-request-pattern.js";

export type ServiceWorkerStopInput = {
  context: BrowserContext;
  /** A page whose CDP session can see and close browser targets: the extension's control page. */
  cdpPage: Page;
  scenarioOrigins: readonly string[];
  onSiteRequest: string;
  log: PerturbationLog;
  /** How often, and for how long after the stop, the target list is read for the worker's fate. */
  watch?: { intervalMs: number; forMs: number };
};

type TargetInfo = { targetId: string; type: string; url: string };

const WATCH = { intervalMs: 250, forMs: 30_000 };

/** Arms the stop; `disarm` removes the listeners, ends the watch and detaches the CDP session. */
export async function armServiceWorkerStop(input: ServiceWorkerStopInput): Promise<{ disarm(): Promise<void> }> {
  const { context, log } = input;
  const watch = input.watch ?? WATCH;
  const matches = siteRequestMatcher(input.onSiteRequest, input.scenarioOrigins);
  const session: CDPSession = await context.newCDPSession(input.cdpPage);
  let triggered: Request | undefined;
  let stopping: Promise<void> | undefined;
  let disarmed = false;

  const extensionWorkers = async (): Promise<TargetInfo[]> => ((await session.send("Target.getTargets")) as { targetInfos: TargetInfo[] }).targetInfos.filter(isExtensionWorker);

  /** Reads the target list until the stopped workers are gone and a successor is up, or the watch ends. */
  const watchFate = async (stopped: ReadonlySet<string>): Promise<void> => {
    let gone = false;
    let started = false;
    const deadline = Date.now() + watch.forMs;
    while (!disarmed && !(gone && started) && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, watch.intervalMs));
      const workers = await extensionWorkers();
      if (!gone && !workers.some(worker => stopped.has(worker.targetId))) {
        gone = true;
        log.record("worker.gone", {});
      }
      // Chrome may list the restarted worker under the stopped one's target id, so once that left the list any extension worker is the successor.
      const successor = gone ? workers[0] : workers.find(worker => !stopped.has(worker.targetId));
      if (!started && successor) {
        started = true;
        log.record("worker.started", { target: successor.targetId.slice(0, 8), sameTarget: stopped.has(successor.targetId) });
      }
    }
    if (!gone || !started) log.record("worker.watch-ended", { gone, started, disarmed });
  };

  const stop = async (request: Request): Promise<void> => {
    const workers = await extensionWorkers();
    if (workers.length === 0) {
      log.record("fault.missed", { reason: "no extension service worker was running", path: new URL(request.url()).pathname });
      return;
    }
    const stopped = new Set<string>();
    for (const worker of workers) {
      stopped.add(worker.targetId);
      const { success } = await session.send("Target.closeTarget", { targetId: worker.targetId }) as { success?: boolean };
      log.fire("worker.stopped", { target: worker.targetId.slice(0, 8), closed: success !== false, workers: workers.length });
    }
    await watchFate(stopped);
  };

  /** A stop that could not be made is recorded as missed, with why; the run goes on unperturbed and its record says so. */
  const stopAndRecord = async (request: Request): Promise<void> => {
    try { await stop(request); } catch (error) { log.record(log.firedAtMs() === undefined ? "fault.missed" : "worker.watch-failed", { reason: error instanceof Error ? error.message.split("\n")[0]! : String(error) }); }
  };

  const onRequest = (request: Request): void => {
    if (triggered || request.serviceWorker() || !matches(request.url())) return;
    triggered = request;
    log.record("site-request.sent", { method: request.method(), path: new URL(request.url()).pathname });
    stopping = stopAndRecord(request);
  };
  const onRequestDone = (outcome: "finished" | "failed") => (request: Request): void => {
    if (request === triggered) log.record(`site-request.${outcome}`, { path: new URL(request.url()).pathname });
  };
  const finished = onRequestDone("finished");
  const failed = onRequestDone("failed");
  context.on("request", onRequest);
  context.on("requestfinished", finished);
  context.on("requestfailed", failed);
  log.record("worker-stop.armed", { onSiteRequest: input.onSiteRequest });
  return {
    disarm: async () => {
      disarmed = true;
      context.off("request", onRequest);
      context.off("requestfinished", finished);
      context.off("requestfailed", failed);
      await stopping;
      await session.detach().catch((error: unknown) => log.record("worker-stop.detach-failed", { reason: error instanceof Error ? error.message.split("\n")[0]! : String(error) }));
    },
  };
}

function isExtensionWorker(info: TargetInfo): boolean {
  return info.type === "service_worker" && info.url.startsWith("chrome-extension://");
}
