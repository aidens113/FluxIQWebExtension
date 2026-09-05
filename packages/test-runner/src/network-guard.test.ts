import assert from "node:assert/strict";
import test from "node:test";
import type { BrowserContext, Route, WebSocketRoute } from "@playwright/test";
import {
  DeterministicNetworkViolationError,
  installDeterministicNetworkGuard,
  isAllowedDeterministicDestination,
  scenarioNetworkOrigins,
} from "./network-guard.js";

const policy = {
  scenarioOrigins: ["http://127.0.0.1:4100", "http://localhost:4100"],
  fluxiqOrigins: ["https://panel.example.test"],
  gatewayOrigins: ["wss://gateway.example.test"],
};

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
