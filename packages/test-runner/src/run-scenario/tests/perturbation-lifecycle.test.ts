import assert from "node:assert/strict";
import test from "node:test";
import type { BrowserContext, Page } from "@playwright/test";
import type { RunningTopology } from "../../coordinator.js";
import { startPerturbationLifecycle } from "../perturbation-lifecycle.js";

const topology = { gatewayUrl: "ws://127.0.0.1:59998/client", scenarioOrigin: "http://127.0.0.1:4100" } as unknown as RunningTopology;

test("without a perturbation the topology is the run's own and nothing is armed or written", async () => {
  const written: string[] = [];
  const lifecycle = await startPerturbationLifecycle(undefined, topology);
  assert.equal(lifecycle.topology, topology);
  await lifecycle.arm({ context: {} as BrowserContext, controlPage: {} as Page, scenarioOrigins: [] });
  await lifecycle.writeRecord({ writeStructured: async relativePath => { written.push(relativePath); } });
  assert.deepEqual(written, []);
});

test("a dropped result launches against the relay and writes its record, and a failed write does not fail the run", async () => {
  const lifecycle = await startPerturbationLifecycle({ kind: "drop-action-result", afterCommittingActs: 1 }, topology);
  assert.notEqual(lifecycle.topology.gatewayUrl, topology.gatewayUrl);
  assert.match(lifecycle.topology.gatewayUrl ?? "", /^ws:\/\/127\.0\.0\.1:\d+\/client$/u);
  const written = new Map<string, unknown>();
  await lifecycle.writeRecord({ writeStructured: async (relativePath, value) => { written.set(relativePath, value); } });
  const record = written.get("snapshots/perturbation.json") as { perturbation: unknown; fired: boolean };
  assert.deepEqual(record.perturbation, { kind: "drop-action-result", afterCommittingActs: 1 });
  assert.equal(record.fired, false);

  const failing = await startPerturbationLifecycle({ kind: "drop-action-result", afterCommittingActs: 1 }, topology);
  await failing.writeRecord({ writeStructured: async () => { throw new Error("disk full"); } });
});
