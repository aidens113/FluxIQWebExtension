import assert from "node:assert/strict";
import test from "node:test";
import type { BrowserContext, Page } from "@playwright/test";
import { PerturbationLog } from "../perturbation-log.js";
import { startRunPerturbation } from "../start-run-perturbation.js";

test("a dropped result points the run's gateway at the relay and leaves the rest of the topology alone", async () => {
  const topology = { gatewayUrl: "ws://127.0.0.1:59999/client", scenarioOrigin: "http://127.0.0.1:4100" };
  const { session, topology: next } = await startRunPerturbation({ kind: "drop-action-result", afterCommittingActs: 1 }, topology);
  try {
    assert.match(next.gatewayUrl, /^ws:\/\/127\.0\.0\.1:\d+\/client$/u);
    assert.notEqual(next.gatewayUrl, topology.gatewayUrl);
    assert.equal(next.scenarioOrigin, topology.scenarioOrigin);
    assert.equal(topology.gatewayUrl, "ws://127.0.0.1:59999/client", "the caller's topology is not changed in place");
  } finally {
    const report = await session.close();
    assert.equal(report.fired, false);
    assert.ok(report.events.some(event => event.event === "fault.not-fired"));
  }
});

test("a dropped result needs a gateway to sit in front of", async () => {
  await assert.rejects(startRunPerturbation({ kind: "drop-action-result", afterCommittingActs: 1 }, {}));
});

test("after the fault fires both sides are read at each delay, screened, and an unreadable side says why", async () => {
  // A stop-service-worker session over a fake browser: the trigger request closes the fake worker and fires.
  const handlers = new Map<string, (value: unknown) => void>();
  const context = {
    serviceWorkers: () => [],
    on: (name: string, handler: (value: unknown) => void) => { handlers.set(name, handler); },
    off: () => undefined,
    newCDPSession: async () => ({
      send: async (method: string) => (method === "Target.getTargets" ? { targetInfos: [{ targetId: "W1", type: "service_worker", url: "chrome-extension://x/bg.js" }] } : { success: true }),
      on: () => undefined,
      off: () => undefined,
      detach: async () => undefined,
    }),
  } as unknown as BrowserContext;
  const { session, topology } = await startRunPerturbation({ kind: "stop-service-worker", onSiteRequest: "/api/x" }, { gatewayUrl: "ws://127.0.0.1:1/client" }, { afterFaultDelaysMs: [0, 20] });
  assert.equal(topology.gatewayUrl, "ws://127.0.0.1:1/client");
  await session.armBrowser({
    context, cdpPage: {} as Page, scenarioOrigins: ["http://127.0.0.1:4100"],
    readers: {
      extension: async () => ({ connectionState: "reconnecting", paired: true, sessionId: "s-1", settings: { token: "never-kept" }, runtime: { state: "running", commandId: "c1", actionType: "web.dom.click", targetName: "Confirm" } }),
      core: async () => { throw new Error("Core is gone\nstack"); },
    },
  });
  handlers.get("request")?.({ url: () => "http://127.0.0.1:4100/api/x", method: () => "POST", serviceWorker: () => null });
  const deadline = Date.now() + 5_000;
  while (session.report().afterFault.length < 2 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  const report = await session.close();
  assert.equal(report.fired, true);
  assert.deepEqual(report.afterFault.map(item => item.afterMs), [0, 20]);
  const first = report.afterFault[0]!;
  assert.deepEqual(first.extension, { connectionState: "reconnecting", paired: true, sessionPresent: true, queueSize: null, gatewayOrigin: null, lastError: null, runtime: { state: "running", commandId: "c1", actionType: "web.dom.click", startedAt: null, finishedAt: null, error: null } });
  assert.deepEqual(first.core, { unreadable: "Core is gone" });
  assert.ok(!JSON.stringify(report).includes("never-kept"));
});

test("the log fires once, tells a late listener at once, and records a second fault without moving the first", () => {
  let now = 1_000;
  const log = new PerturbationLog({ kind: "drop-action-result", afterCommittingActs: 1 }, () => now);
  const heard: number[] = [];
  log.onFired(event => heard.push(event.atMs));
  log.fire("fault.fired", { commandId: "c1" });
  now = 2_000;
  log.fire("fault.fired", { commandId: "c2" });
  log.onFired(event => heard.push(event.atMs));
  assert.deepEqual(heard, [1_000, 1_000]);
  const report = log.report();
  assert.equal(report.firedAt, new Date(1_000).toISOString());
  assert.deepEqual(report.events.map(event => event.event), ["fault.fired", "fault.repeated"]);
});
