import assert from "node:assert/strict";
import test from "node:test";
import type { FluxIQHostLaunchRequest, FluxIQLaunchedHost } from "fluxiq/server";
import { launchHosts } from "../launch-hosts.js";

const request = (hostId: string): FluxIQHostLaunchRequest => ({
  hostId, gatewayUrl: "ws://127.0.0.1:1/client", coreApiUrl: "http://127.0.0.1:1", dataDir: "d", profile: { kind: "fresh" }, headless: true,
  takeEnrolmentTicket: () => "unused", signal: new AbortController().signal
});

test("when one host fails, the ones that started are closed and the error names the failed host", async () => {
  const closed: string[] = [];
  const launch = async (req: FluxIQHostLaunchRequest): Promise<FluxIQLaunchedHost> => {
    if (req.hostId === "host-2") throw new Error("no worker");
    return { hostId: req.hostId, closed: new Promise(() => undefined), close: async () => { closed.push(req.hostId); } };
  };
  await assert.rejects(launchHosts([request("host-1"), request("host-2"), request("host-3")], { extensionPath: "x" }, launch), (error: Error & { code?: string; hostId?: string }) => {
    assert.equal(error.code, "browser_host.launch_failed");
    assert.equal(error.hostId, "host-2");
    assert.match(error.message, /host-2/u);
    return true;
  });
  assert.deepEqual(closed.sort(), ["host-1", "host-3"]);
});

test("all hosts launch in parallel and are returned in request order", async () => {
  let running = 0;
  let peak = 0;
  const launch = async (req: FluxIQHostLaunchRequest): Promise<FluxIQLaunchedHost> => {
    peak = Math.max(peak, ++running);
    await new Promise(resolve => setImmediate(resolve));
    running--;
    return { hostId: req.hostId, closed: new Promise(() => undefined), close: async () => undefined };
  };
  const hosts = await launchHosts([request("host-1"), request("host-2"), request("host-3")], { extensionPath: "x" }, launch);
  assert.deepEqual(hosts.map(host => host.hostId), ["host-1", "host-2", "host-3"]);
  assert.equal(peak, 3);
});
