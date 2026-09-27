import assert from "node:assert/strict";
import test from "node:test";
import type { BrowserContext, Route, WebSocketRoute } from "@playwright/test";
import type { RunningTopology } from "../../../coordinator.js";
import { scenarioNetworkOrigins } from "../../../network-guard.js";
import { installRunNetworkGuard } from "../install-run-network-guard.js";

const SCENARIO = "http://127.0.0.1:4100";
const FLUXIQ = "http://127.0.0.1:4200";
const GATEWAY = "ws://127.0.0.1:4300";

function topology(overrides: Partial<RunningTopology> = {}): RunningTopology {
  return { scenarioOrigin: SCENARIO, fluxiqOrigin: FLUXIQ, allocation: { controllerToken: "token.controller" }, ...overrides } as unknown as RunningTopology;
}

async function guardFor(active: RunningTopology) {
  let requestHandler!: (route: Route) => Promise<void>;
  let websocketHandler!: (route: WebSocketRoute) => Promise<void>;
  const context = {
    route: async (_pattern: string, handler: typeof requestHandler) => { requestHandler = handler; },
    routeWebSocket: async (_pattern: RegExp, handler: typeof websocketHandler) => { websocketHandler = handler; },
  } as unknown as BrowserContext;
  const guard = await installRunNetworkGuard(context, active, scenarioNetworkOrigins(active.scenarioOrigin));
  const outcomes: string[] = [];
  const visit = async (url: string) => {
    await requestHandler({
      request: () => ({ url: () => url, resourceType: () => "document" }),
      continue: async () => { outcomes.push(`allowed ${url}`); },
      abort: async () => { outcomes.push(`blocked ${url}`); },
    } as unknown as Route);
  };
  const connect = async (url: string) => {
    await websocketHandler({
      url: () => url,
      connectToServer: () => { outcomes.push(`allowed ${url}`); return undefined; },
      close: async () => { outcomes.push(`blocked ${url}`); },
    } as unknown as WebSocketRoute);
  };
  return { guard, outcomes, visit, connect };
}

test("a run's session reaches its own fixture and its own Core, and nothing else", async () => {
  const session = await guardFor(topology());
  for (const url of [`${SCENARIO}/scenarios/basic-form/`, "http://localhost:4100/frame", `${FLUXIQ}/api/auth/session`, "https://outside.invalid/beacon", "http://127.0.0.1:4999/probe"]) {
    await session.visit(url);
  }
  assert.deepEqual(session.outcomes.map(item => item.split(" ")[0]), ["allowed", "allowed", "allowed", "blocked", "blocked"], "both Scenario Lab loopback spellings are the fixture; another loopback port is not");
  assert.deepEqual(session.guard.violations().map(item => item.destination), ["https://outside.invalid/beacon", "http://127.0.0.1:4999/probe"]);
});

/**
 * The gateway is a separate origin only on a topology that reports one: an
 * isolated Core serves it from `fluxiqOrigin`, and a spread that always passed
 * `gatewayOrigins` would have put `undefined` in the allowlist.
 */
test("a gateway origin joins the policy only when the topology reports one", async () => {
  const withGateway = await guardFor(topology({ gatewayUrl: GATEWAY }));
  await withGateway.connect(`${GATEWAY}/client`);
  assert.deepEqual(withGateway.outcomes, [`allowed ${GATEWAY}/client`], "the reported gateway is this run's own");
  assert.deepEqual(withGateway.guard.violations(), []);

  const withoutGateway = await guardFor(topology());
  await withoutGateway.connect(`${GATEWAY}/client`);
  assert.deepEqual(withoutGateway.guard.violations().map(item => item.destination), [`${GATEWAY}/client`]);
});
