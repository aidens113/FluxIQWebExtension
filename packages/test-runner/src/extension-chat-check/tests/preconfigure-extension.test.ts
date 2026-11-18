import assert from "node:assert/strict";
import test from "node:test";
import { preconfigureExtension, preconfigureExtensionWhenReady, type SettingsWorker } from "../preconfigure-extension.js";

type Stored = { key: string; value: Record<string, unknown> };
const addresses = { gatewayUrl: "ws://127.0.0.1:9/gw", coreApiUrl: "http://127.0.0.1:8" };

function worker(evaluate: (arg: unknown) => unknown): SettingsWorker {
  return { evaluate: (async (_run: unknown, arg: unknown) => evaluate(arg)) as SettingsWorker["evaluate"] };
}

test("preconfigureExtension stores the isolated Core's addresses under the settings key", async () => {
  const calls: Stored[] = [];
  await preconfigureExtension(worker(arg => {
    calls.push(arg as Stored);
    return "ok";
  }), addresses);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.key, "fluxiq.settings");
  assert.equal(calls[0]!.value.coreApiUrl, "http://127.0.0.1:8");
  assert.equal(calls[0]!.value.gatewayUrl, "ws://127.0.0.1:9/gw");
});

test("preconfigureExtension fails when the worker cannot store the settings", async () => {
  await assert.rejects(preconfigureExtension(worker(() => "no extension APIs in the worker"), addresses), /not stored before the panel opened/u);
});

test("preconfigureExtensionWhenReady writes through a live worker, then stops it and wakes its successor, in that order", async () => {
  const order: string[] = [];
  const stop = async () => { order.push("stop"); };
  const wake = async () => { order.push("wake"); };
  const live = worker(() => {
    order.push("write");
    return "ok";
  });
  const workers = [undefined, live];
  await preconfigureExtensionWhenReady(() => workers.length > 1 ? workers.shift() : workers[0], addresses, { waitMs: 5_000, stop, wake });
  assert.deepEqual(order, ["write", "stop", "wake"]);
});

test("preconfigureExtensionWhenReady reports the last failure, and stops nothing, when no worker stores the settings in time", async () => {
  const order: string[] = [];
  const stop = async () => { order.push("stop"); };
  const wake = async () => { order.push("wake"); };
  const closed = worker(() => { throw new Error("Target closed"); });
  await assert.rejects(preconfigureExtensionWhenReady(() => closed, addresses, { waitMs: 300, stop, wake }), /Target closed/u);
  assert.deepEqual(order, []);
});
