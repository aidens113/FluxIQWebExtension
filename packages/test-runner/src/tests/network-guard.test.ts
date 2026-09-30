import assert from "node:assert/strict";
import test from "node:test";
import type { BrowserContext, Route, WebSocketRoute } from "@playwright/test";
import {
  DeterministicNetworkViolationError,
  installDeterministicNetworkGuard,
  isAllowedDeterministicDestination,
  scenarioNetworkOrigins,
} from "../network-guard.js";

const policy = {
  scenarioOrigins: ["http://127.0.0.1:4100", "http://localhost:4100"],
  fluxiqOrigins: ["https://panel.example.test"],
  gatewayOrigins: ["wss://gateway.example.test"],
};
/** A context with no service workers, so the guard has nothing to prove. */
const NO_SERVICE_WORKERS = { serviceWorkers: () => [], on: () => undefined };

test("allows only internal schemes and exact declared HTTP and WebSocket origins", () => {
  for (const url of [
    "chrome-extension://abc/sidepanel/index.html", "data:text/plain,ok", "about:blank", "blob:https://panel.example.test/id",
    "http://127.0.0.1:4100/scenarios/basic-form/", "http://localhost:4100/frame", "https://panel.example.test/api/auth/session",
    "wss://gateway.example.test/client",
  ]) assert.equal(isAllowedDeterministicDestination(url, policy), true, url);
  for (const url of [
    "https://example.test/", "https://panel.example.test.evil.invalid/", "http://127.0.0.1:4101/", "ws://gateway.example.test/client",
    "file:///tmp/secret", "chrome://settings/",
  ]) assert.equal(isAllowedDeterministicDestination(url, policy), false, url);
});

test("derives only the two exact Scenario Lab loopback origins", () => {
  assert.deepEqual(scenarioNetworkOrigins("http://127.0.0.1:4100"), ["http://127.0.0.1:4100", "http://localhost:4100"]);
  assert.deepEqual(scenarioNetworkOrigins("http://localhost:4100"), ["http://localhost:4100", "http://127.0.0.1:4100"]);
});

test("context-wide guard rejects and records sanitized page and WebSocket destinations", async () => {
  let requestHandler!: (route: Route) => Promise<void>;
  let websocketHandler!: (route: WebSocketRoute) => Promise<void>;
  const context = {
    route: async (_pattern: string, handler: typeof requestHandler) => { requestHandler = handler; },
    routeWebSocket: async (_pattern: RegExp, handler: typeof websocketHandler) => { websocketHandler = handler; },
    ...NO_SERVICE_WORKERS,
  } as unknown as BrowserContext;
  const guard = await installDeterministicNetworkGuard(context, policy);
  let aborted = "";
  await requestHandler({
    request: () => ({ url: () => "https://outside.invalid/path?secret=hidden", resourceType: () => "document" }),
    abort: async (reason: string) => { aborted = reason; }, continue: async () => undefined,
  } as unknown as Route);
  let closed = 0;
  await websocketHandler({ url: () => "wss://outside.invalid/socket?token=hidden", close: async () => { closed += 1; } } as unknown as WebSocketRoute);
  assert.equal(aborted, "blockedbyclient");
  assert.equal(closed, 1);
  assert.deepEqual(guard.violations(), [
    { kind: "request", destination: "https://outside.invalid/path", resourceType: "document" },
    { kind: "websocket", destination: "wss://outside.invalid/socket" },
  ]);
  assert.throws(() => guard.assertNoViolations(), DeterministicNetworkViolationError);
});

test("a loopback origin proven to be the Scenario Lab joins the allowlist; unproven origins stay violations", async () => {
  let requestHandler!: (route: Route) => Promise<void>;
  const context = {
    route: async (_pattern: string, handler: typeof requestHandler) => { requestHandler = handler; },
    routeWebSocket: async () => undefined,
    ...NO_SERVICE_WORKERS,
  } as unknown as BrowserContext;
  const asked: string[] = [];
  const guard = await installDeterministicNetworkGuard(context, {
    ...policy,
    verifyScenarioOrigin: async (origin) => { asked.push(origin); if (origin.endsWith(":53998")) throw new Error("proof crashed"); return origin === "http://127.0.0.1:53111"; },
  });
  const outcomes: string[] = [];
  const route = (url: string) => ({
    request: () => ({ url: () => url, resourceType: () => "document" }),
    continue: async () => { outcomes.push(`continue ${url}`); },
    abort: async () => { outcomes.push(`abort ${url}`); },
  }) as unknown as Route;
  for (const url of [
    "http://127.0.0.1:53111/scenarios/iframe-checkout/cross-frame", "http://127.0.0.1:53111/favicon.ico",
    "http://127.0.0.1:53999/probe", "http://127.0.0.1:53998/probe", "https://outside.invalid/",
  ]) await requestHandler(route(url));
  assert.deepEqual(asked, ["http://127.0.0.1:53111", "http://127.0.0.1:53999", "http://127.0.0.1:53998"]);
  assert.deepEqual(outcomes.map(item => item.split(" ")[0]), ["continue", "continue", "abort", "abort", "abort"]);
  assert.deepEqual(guard.violations().map(item => item.destination), ["http://127.0.0.1:53999/probe", "http://127.0.0.1:53998/probe", "https://outside.invalid/"]);
});

test("without a proof hook an unlisted loopback port is a violation", async () => {
  let requestHandler!: (route: Route) => Promise<void>;
  const context = { route: async (_pattern: string, handler: typeof requestHandler) => { requestHandler = handler; }, routeWebSocket: async () => undefined, ...NO_SERVICE_WORKERS } as unknown as BrowserContext;
  const guard = await installDeterministicNetworkGuard(context, policy);
  await requestHandler({ request: () => ({ url: () => "http://127.0.0.1:53111/frame", resourceType: () => "document" }), continue: async () => undefined, abort: async () => undefined } as unknown as Route);
  assert.deepEqual(guard.violations(), [{ kind: "request", destination: "http://127.0.0.1:53111/frame", resourceType: "document" }]);
});

// --- Service workers --------------------------------------------------------
// Measured 2026-09-28 (Playwright 1.51.1): an extension background's fetch
// reached the internet while `context.route` saw nothing, unless
// PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS was set. The guard sets it and
// then proves, per worker, that its traffic really is routed.

type WorkerBehaviour = "routed" | "unrouted" | "gone";

/** A context whose route handler is captured, with workers present at install and able to attach later. */
async function contextWithWorkers(initial: Array<{ url: string; behaviour: WorkerBehaviour }>) {
  let requestHandler!: (route: Route) => Promise<void>;
  let onWorker: ((worker: unknown) => void) | undefined;
  const outcomes: string[] = [];
  const routeFor = (url: string) => ({
    request: () => ({ url: () => url, resourceType: () => "fetch" }),
    continue: async () => { outcomes.push(`continue ${url}`); },
    abort: async () => { outcomes.push(`abort ${url}`); },
  }) as unknown as Route;
  const worker = (url: string, behaviour: WorkerBehaviour) => ({
    url: () => url,
    evaluate: async (_fn: unknown, arg?: { url: string; timeoutMs: number }) => {
      if (behaviour === "gone") throw new Error("Target page, context or browser has been closed");
      if (arg === undefined) return true;
      // A routed worker's fetch reaches the context route; an unrouted one's goes straight to the network.
      if (behaviour === "routed") await requestHandler(routeFor(arg.url));
    },
  });
  const context = {
    route: async (_pattern: string, handler: typeof requestHandler) => { requestHandler = handler; },
    routeWebSocket: async () => undefined,
    serviceWorkers: () => initial.map(item => worker(item.url, item.behaviour)),
    on: (event: string, handler: (worker: unknown) => void) => { if (event === "serviceworker") onWorker = handler; },
  } as unknown as BrowserContext;
  const guard = await installDeterministicNetworkGuard(context, policy);
  return { guard, outcomes, attach: (url: string, behaviour: WorkerBehaviour) => onWorker?.(worker(url, behaviour)) };
}

test("loading the guard turns on Playwright's service-worker routing", () => {
  assert.equal(process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS, "1");
});

test("a service worker whose traffic reaches the route is proven, and its canary is blocked without a violation", async () => {
  const { guard, outcomes } = await contextWithWorkers([{ url: "chrome-extension://abcdef/background.js", behaviour: "routed" }]);
  await guard.serviceWorkersProven();
  assert.deepEqual(guard.violations(), []);
  assert.equal(outcomes.length, 1);
  assert.match(outcomes[0]!, /^abort http:\/\/fluxiq-network-guard-canary\.invalid\/[0-9a-f-]{36}$/u, "the canary is aborted, never continued");
  assert.doesNotThrow(() => guard.assertNoViolations());
});

test("a service worker whose traffic bypasses the route is a violation that fails the lane", async () => {
  const { guard } = await contextWithWorkers([{ url: "chrome-extension://abcdef/background.js?token=hidden", behaviour: "unrouted" }]);
  await guard.serviceWorkersProven();
  assert.deepEqual(guard.violations(), [{ kind: "service-worker", destination: "chrome-extension://abcdef" }]);
  assert.throws(() => guard.assertNoViolations(), (error: unknown) => error instanceof DeterministicNetworkViolationError && /service-worker:chrome-extension:\/\/abcdef/u.test(error.message));
});

test("a worker that attaches after install is proven too", async () => {
  const { guard, attach } = await contextWithWorkers([]);
  attach("chrome-extension://abcdef/background.js", "unrouted");
  await guard.serviceWorkersProven();
  assert.deepEqual(guard.violations().map(item => item.kind), ["service-worker"]);
});

test("a worker that goes away before it can be asked is not a finding", async () => {
  const { guard } = await contextWithWorkers([{ url: "chrome-extension://abcdef/background.js", behaviour: "gone" }]);
  await guard.serviceWorkersProven();
  assert.deepEqual(guard.violations(), []);
});

test("a canary is recognised only by its exact one-off URL; any other request to the canary host is a violation", async () => {
  let requestHandler!: (route: Route) => Promise<void>;
  const context = { route: async (_pattern: string, handler: typeof requestHandler) => { requestHandler = handler; }, routeWebSocket: async () => undefined, ...NO_SERVICE_WORKERS } as unknown as BrowserContext;
  const guard = await installDeterministicNetworkGuard(context, policy);
  await requestHandler({ request: () => ({ url: () => "http://fluxiq-network-guard-canary.invalid/guessed", resourceType: () => "fetch" }), continue: async () => undefined, abort: async () => undefined } as unknown as Route);
  assert.deepEqual(guard.violations(), [{ kind: "request", destination: "http://fluxiq-network-guard-canary.invalid/guessed", resourceType: "fetch" }]);
});

test("each internal scheme passes because it is answered inside the browser; every other non-network scheme is refused", () => {
  for (const url of ["chrome-extension://any-id/page.html", "data:text/html,<p>x</p>", "about:srcdoc", "blob:http://127.0.0.1:4100/5f1c"]) {
    assert.equal(isAllowedDeterministicDestination(url, policy), true, url);
  }
  for (const url of ["file:///C:/Users/secret.txt", "chrome://version", "ftp://example.test/", "javascript:alert(1)", "filesystem:http://127.0.0.1:4100/temporary/x"]) {
    assert.equal(isAllowedDeterministicDestination(url, policy), false, url);
  }
});

// --- A worker's scope before its script has run ------------------------------
// Measured 2026-09-30 on Chromium 134 (t174-w7): Playwright announces a service
// worker while its global scope is still being set up -- an evaluate there sees
// `setTimeout is not defined` -- and a `fetch()` evaluated at that moment kills
// the extension's renderer (STATUS_BREAKPOINT), taking the worker and every
// extension page with it. The canary fired then in 9 of 10 Lab starts; the same
// canary 3 s later crashed nothing. So the canary must wait for the scope.

/** A worker whose scope is set up only after `readyAfter` readiness questions; a canary before then "crashes" it. */
function unreadyWorker(readyAfter: number, requestHandler: () => (route: Route) => Promise<void>) {
  const calls: string[] = [];
  let asked = 0;
  return {
    calls,
    worker: {
      url: () => "chrome-extension://abcdef/background/index.js",
      evaluate: async (_fn: unknown, arg?: { url: string; timeoutMs: number }) => {
        if (arg === undefined) { asked += 1; calls.push(asked > readyAfter ? "ready" : "not-ready"); return asked > readyAfter; }
        if (asked <= readyAfter) { calls.push("canary-before-ready"); throw new Error("Target crashed"); }
        calls.push("canary");
        await requestHandler()({ request: () => ({ url: () => arg.url, resourceType: () => "fetch" }), continue: async () => undefined, abort: async () => undefined } as unknown as Route);
      },
    },
  };
}

function contextWithWorker(worker: unknown) {
  let requestHandler!: (route: Route) => Promise<void>;
  const context = {
    route: async (_pattern: string, handler: typeof requestHandler) => { requestHandler = handler; },
    routeWebSocket: async () => undefined,
    serviceWorkers: () => [worker],
    on: () => undefined,
  } as unknown as BrowserContext;
  return { context, handler: () => requestHandler };
}

test("the canary is not fetched in a worker whose global scope is not set up yet", async () => {
  let handler!: () => (route: Route) => Promise<void>;
  const subject = unreadyWorker(3, () => handler());
  const built = contextWithWorker(subject.worker);
  handler = built.handler;
  const guard = await installDeterministicNetworkGuard(built.context, policy, { workerScopeIntervalMs: 1 });
  await guard.serviceWorkersProven();
  assert.deepEqual(subject.calls, ["not-ready", "not-ready", "not-ready", "ready", "canary"]);
  assert.deepEqual(guard.violations(), [], "a worker proven after its scope was ready is not a finding");
});

test("a worker whose scope never becomes ready is unproven, and says so as a violation", async () => {
  let handler!: () => (route: Route) => Promise<void>;
  const subject = unreadyWorker(Number.POSITIVE_INFINITY, () => handler());
  const built = contextWithWorker(subject.worker);
  handler = built.handler;
  const guard = await installDeterministicNetworkGuard(built.context, policy, { workerScopeIntervalMs: 1, workerScopeTimeoutMs: 20 });
  await guard.serviceWorkersProven();
  assert.ok(!subject.calls.includes("canary-before-ready") && !subject.calls.includes("canary"), "no canary is ever sent into an unready scope");
  assert.deepEqual(guard.violations(), [{ kind: "service-worker", destination: "chrome-extension://abcdef" }]);
});
