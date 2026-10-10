import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import type { BrowserContext, Page } from "@playwright/test";
import { PerturbationLog } from "../perturbation-log.js";
import { armServiceWorkerStop } from "../stop-service-worker.js";

/** A browser context that emits what the test says, and a CDP session that lists and closes targets. */
function fakeBrowser(targets: Array<{ targetId: string; type: string; url: string }>) {
  const context = new EventEmitter() as EventEmitter & { serviceWorkers(): unknown[]; newCDPSession(page: unknown): Promise<unknown> };
  const sent: Array<{ method: string; params?: unknown }> = [];
  let detached = false;
  context.serviceWorkers = () => [];
  context.newCDPSession = async () => ({
    send: async (method: string, params?: unknown) => {
      sent.push({ method, ...(params === undefined ? {} : { params }) });
      if (method === "Target.getTargets") return { targetInfos: [...targets] };
      if (method === "Target.closeTarget") {
        // Chrome drops the stopped worker, and starts a successor on the extension's next event.
        targets.splice(targets.findIndex(item => item.targetId === (params as { targetId: string }).targetId), 1);
        setTimeout(() => targets.push({ targetId: "FEDCBA9876543210", type: "service_worker", url: "chrome-extension://abc/background.js" }), 5);
        return { success: true };
      }
      throw new Error(`unexpected ${method}`);
    },
    detach: async () => { detached = true; },
  });
  const request = (url: string, fromWorker = false) => ({ url: () => url, method: () => "POST", serviceWorker: () => (fromWorker ? {} : null) });
  return { context: context as unknown as BrowserContext, emitter: context, sent, request, detached: () => detached };
}

const origin = "http://127.0.0.1:4100";
const workerTarget = { targetId: "ABCDEF0123456789", type: "service_worker", url: "chrome-extension://abc/background.js" };

test("the extension's worker is closed when the site receives the matching request, once, after it was sent", async () => {
  const browser = fakeBrowser([{ targetId: "PAGE", type: "page", url: `${origin}/` }, workerTarget]);
  const log = new PerturbationLog({ kind: "stop-service-worker", onSiteRequest: "/api/social-network-feed/confirm-request" });
  const armed = await armServiceWorkerStop({ context: browser.context, cdpPage: {} as Page, scenarioOrigins: [origin], onSiteRequest: "/api/social-network-feed/confirm-request", log, watch: { intervalMs: 2, forMs: 2_000 } });
  browser.emitter.emit("request", browser.request(`${origin}/api/social-network-feed/delete-request`));
  browser.emitter.emit("request", browser.request(`${origin}/api/social-network-feed/confirm-request`, true));
  assert.equal(log.report().fired, false, "another path, or the worker's own request, is not the trigger");
  const trigger = browser.request(`${origin}/api/social-network-feed/confirm-request`);
  browser.emitter.emit("request", trigger);
  browser.emitter.emit("request", browser.request(`${origin}/api/social-network-feed/confirm-request`));
  const deadline = Date.now() + 2_000;
  while (!log.report().events.some(event => event.event === "worker.started") && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
  await armed.disarm();
  const report = log.report();
  assert.equal(report.fired, true);
  assert.equal(report.firedEvent, "worker.stopped");
  assert.deepEqual(browser.sent.filter(item => item.method === "Target.closeTarget"), [{ method: "Target.closeTarget", params: { targetId: workerTarget.targetId } }]);
  const names = report.events.map(event => event.event);
  assert.ok(names.indexOf("site-request.sent") < names.indexOf("worker.stopped"));
  assert.deepEqual(names.filter(name => name === "worker.gone" || name === "worker.started"), ["worker.gone", "worker.started"], "the stopped worker going and its successor starting are both recorded");
  assert.equal(browser.detached(), true);
});

test("a trigger with no extension worker running is recorded as missed, not fired", async () => {
  const browser = fakeBrowser([{ targetId: "PAGE", type: "page", url: `${origin}/` }]);
  const log = new PerturbationLog({ kind: "stop-service-worker", onSiteRequest: "/api/*" });
  const armed = await armServiceWorkerStop({ context: browser.context, cdpPage: {} as Page, scenarioOrigins: [origin], onSiteRequest: "/api/*", log });
  browser.emitter.emit("request", browser.request(`${origin}/api/anything`));
  await armed.disarm();
  assert.equal(log.report().fired, false);
  assert.ok(log.report().events.some(event => event.event === "fault.missed"));
});
