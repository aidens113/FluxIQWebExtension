import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import type { BrowserContext, Page } from "@playwright/test";
import { PerturbationLog } from "../perturbation-log.js";
import { armServiceWorkerStop } from "../stop-service-worker.js";

/**
 * A browser context that emits what the test says, and a CDP session that lists and closes targets and answers a
 * worker target's `performance.timeOrigin` to a non-flattened attach, as Chrome does. `stop` says what a close
 * does: `restart` (the worker stops; Chrome starts a successor with a new global scope, under the stopped target's
 * id when `sameTarget`) or `ignored` (the close reports success and the worker runs on).
 */
function fakeBrowser(targets: Array<{ targetId: string; type: string; url: string }>, options: { stop?: "restart" | "ignored"; sameTarget?: boolean } = {}) {
  const context = new EventEmitter() as EventEmitter & { newCDPSession(page: unknown): Promise<unknown> };
  const sent: Array<{ method: string; params?: unknown }> = [];
  let detached = false;
  /** Each worker target's running global scope, by its time origin; none while it is stopped. */
  const instances = new Map<string, number>(targets.filter(target => target.type === "service_worker").map(target => [target.targetId, 1_000.25]));
  const attached = new Map<string, string>();
  const session = new EventEmitter() as EventEmitter & { send(method: string, params?: unknown): Promise<unknown>; detach(): Promise<void> };
  session.send = async (method: string, params?: unknown) => {
    sent.push({ method, ...(params === undefined ? {} : { params }) });
    if (method === "Target.getTargets") return { targetInfos: [...targets] };
    if (method === "Target.attachToTarget") {
      const { targetId } = params as { targetId: string };
      if (!instances.has(targetId)) throw new Error("No target with given id found");
      const sessionId = `session-${attached.size + 1}`;
      attached.set(sessionId, targetId);
      return { sessionId };
    }
    if (method === "Target.sendMessageToTarget") {
      const { sessionId, message } = params as { sessionId: string; message: string };
      const origin = instances.get(attached.get(sessionId) ?? "");
      const { id } = JSON.parse(message) as { id: number };
      setTimeout(() => session.emit("Target.receivedMessageFromTarget", { sessionId, message: JSON.stringify({ id, result: { result: { type: "number", value: origin } } }) }), 1);
      return {};
    }
    if (method === "Target.detachFromTarget") return {};
    if (method === "Target.closeTarget") {
      if (options.stop === "ignored") return { success: true };
      // Chrome drops the stopped worker, and starts a successor on the extension's next event.
      const closed = (params as { targetId: string }).targetId;
      instances.delete(closed);
      if (!options.sameTarget) targets.splice(targets.findIndex(item => item.targetId === closed), 1);
      setTimeout(() => {
        const successor = options.sameTarget ? closed : "FEDCBA9876543210";
        if (!options.sameTarget) targets.push({ targetId: successor, type: "service_worker", url: "chrome-extension://abc/background.js" });
        instances.set(successor, 9_000.5);
      }, 5);
      return { success: true };
    }
    throw new Error(`unexpected ${method}`);
  };
  session.detach = async () => { detached = true; };
  context.newCDPSession = async () => session;
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
  assert.ok(names.includes("worker.restarted"), "a worker with a new global scope answered: the stop is proven");
  assert.equal(names.includes("worker.still-running"), false);
  assert.equal(browser.detached(), true);
});

/** Fires the stop on one matching request and waits until the watch says how the worker fared. */
async function fireAndWatch(browser: ReturnType<typeof fakeBrowser>) {
  const log = new PerturbationLog({ kind: "stop-service-worker", onSiteRequest: "/api/*" });
  const armed = await armServiceWorkerStop({ context: browser.context, cdpPage: {} as Page, scenarioOrigins: [origin], onSiteRequest: "/api/*", log, watch: { intervalMs: 2, forMs: 300 } });
  browser.emitter.emit("request", browser.request(`${origin}/api/add`));
  const deadline = Date.now() + 2_000;
  while (!log.report().events.some(event => event.event === "worker.restarted" || event.event === "worker.watch-ended") && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
  await armed.disarm();
  return log.report().events;
}

test("a successor listed under the stopped worker's own target id is still proven a restart, by its new global scope", async () => {
  const events = await fireAndWatch(fakeBrowser([workerTarget], { sameTarget: true }));
  const names = events.map(event => event.event);
  assert.ok(names.includes("worker.instance"));
  assert.equal(names.includes("worker.gone"), false, "the target list never shows the stopped id leave, as in matrix round 1");
  assert.deepEqual(events.find(event => event.event === "worker.restarted")?.detail?.sameTarget, true);
  assert.equal(names.includes("worker.watch-ended"), false);
});

test("a close that did not stop the worker is recorded as still running, and no restart is claimed", async () => {
  const events = await fireAndWatch(fakeBrowser([workerTarget], { stop: "ignored" }));
  const names = events.map(event => event.event);
  assert.ok(names.includes("worker.stopped"), "the close itself reported success");
  assert.ok(names.includes("worker.still-running"));
  assert.equal(names.includes("worker.restarted"), false);
  assert.deepEqual(events.find(event => event.event === "worker.watch-ended")?.detail, { gone: false, started: false, restarted: false, stillRunning: true, disarmed: false });
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
