// The web domain's host-resource port (automation-project-agents plan, `Host
// Actions`): one lease at a time, on the one browser a build may drive, with
// epochs that only rise -- across releases and across a restarted Core.

import assert from "node:assert/strict";
import test from "node:test";
import type { ClientGatewaySession } from "@fluxiq/client-gateway-websocket";
import { AutomationStudioHostResourceScheduler, type AutomationStudioHostResourceGrant } from "fluxiq/automation-studio";
import { createWebAutomationHostRuntime } from "../../host-runtime";
import { createWebAutomationHostResourcePort, WEB_AUTOMATION_HOST_RESOURCE_CAPACITY, webAutomationHostResourceKey } from "..";

function session(clientId: string, overrides: Partial<ClientGatewaySession> = {}): ClientGatewaySession {
  return {
    sessionId: `session-${clientId}`,
    clientId,
    clientType: "extension",
    name: "FluxIQ Browser Extension",
    status: "ready",
    connectedAt: 1,
    lastSeenAt: 1,
    capabilities: [{ id: "web.actions", kind: "action", metadata: { domainId: "web-automation" } }],
    ...overrides
  };
}

const builder = { role: "builder", briefId: "brief-1" };

test("the web domain lends one browser at a time, and the host runtime says so", () => {
  assert.equal(WEB_AUTOMATION_HOST_RESOURCE_CAPACITY, 1);
  assert.equal(createWebAutomationHostResourcePort({ sessions: () => [] }).capacity, 1);
  const noPage = async (): Promise<never> => {
    throw new Error("no page is read in this test");
  };
  const runtime = createWebAutomationHostRuntime({ dispatch: noPage }, () => [session("client-a")]);
  assert.equal(runtime.hostResources.capacity, 1);
});

test("a grant names the one leasable browser's resource by its client id, and the session it lives on", () => {
  const port = createWebAutomationHostResourcePort({ sessions: () => [session("client-a")], now: () => 5_000 });
  assert.deepEqual(port.acquire(builder), { resourceKey: "web.automation:client-a", epoch: 5_000, sessionId: "session-client-a" });
  assert.equal(webAutomationHostResourceKey("client-a"), "web.automation:client-a");
});

test("no browser, or two, answers at_capacity rather than guessing", () => {
  assert.equal(createWebAutomationHostResourcePort({ sessions: () => [] }).acquire(builder), "at_capacity");
  assert.equal(createWebAutomationHostResourcePort({ sessions: () => [session("client-a"), session("client-b")] }).acquire(builder), "at_capacity");
  // Sessions a build may not drive do not count toward the one.
  const others = [
    session("recording", { activeRecordingId: "rec-1" }),
    session("pairing", { status: "pairing_required" }),
    session("cli", { clientType: "cli" }),
    session("other-domain", { capabilities: [{ id: "web.actions", kind: "action", metadata: { domainId: "elsewhere" } }] })
  ];
  assert.equal(createWebAutomationHostResourcePort({ sessions: () => others }).acquire(builder), "at_capacity");
  const granted = createWebAutomationHostResourcePort({ sessions: () => [...others, session("client-a")], now: () => 9 }).acquire(builder);
  assert.deepEqual(granted, { resourceKey: "web.automation:client-a", epoch: 9, sessionId: "session-client-a" });
});

test("a held lease answers at_capacity until it is released, and the next grant's epoch is higher", () => {
  const port = createWebAutomationHostResourcePort({ sessions: () => [session("client-a")], now: () => 1_000 });
  const first = port.acquire(builder) as AutomationStudioHostResourceGrant;
  assert.equal(port.acquire({ role: "builder", briefId: "brief-2" }), "at_capacity");
  port.release({ ...first, resourceKey: "web.automation:client-b", holder: builder });
  assert.equal(port.acquire(builder), "at_capacity", "releasing another resource frees nothing");
  port.release({ ...first, holder: builder });
  const second = port.acquire(builder) as AutomationStudioHostResourceGrant;
  assert.equal(second.resourceKey, first.resourceKey);
  assert.equal(second.epoch, 1_001, "the clock has not moved, so one above the last");
});

test("epochs keep rising across a restarted port, because they are seeded from the clock", () => {
  let clock = 1_000;
  const before = createWebAutomationHostResourcePort({ sessions: () => [session("client-a")], now: () => clock });
  const epochs: number[] = [];
  for (let index = 0; index < 3; index += 1) {
    const grant = before.acquire(builder) as AutomationStudioHostResourceGrant;
    epochs.push(grant.epoch);
    before.release({ ...grant, holder: builder });
  }
  assert.deepEqual(epochs, [1_000, 1_001, 1_002]);
  clock = 61_000;
  const afterRestart = createWebAutomationHostResourcePort({ sessions: () => [session("client-a")], now: () => clock });
  const grant = afterRestart.acquire(builder) as AutomationStudioHostResourceGrant;
  assert.ok(grant.epoch > 1_002, `a restarted port granted epoch ${grant.epoch}, not above 1002`);
});

test("Core's scheduler grants through the port one builder at a time, in order", async () => {
  const scheduler = new AutomationStudioHostResourceScheduler(createWebAutomationHostResourcePort({ sessions: () => [session("client-a")], now: () => 100 }));
  assert.equal(scheduler.capacity, 1);
  const first = await scheduler.acquire(builder);
  const waiting = scheduler.acquire({ role: "builder", briefId: "brief-2" });
  assert.deepEqual(scheduler.snapshot().waiting, [{ role: "builder", briefId: "brief-2" }]);
  await scheduler.release(first);
  const second = await waiting;
  assert.equal(second.resourceKey, first.resourceKey);
  assert.ok(second.epoch > first.epoch);
  assert.equal(scheduler.isCurrent(first), false);
});
