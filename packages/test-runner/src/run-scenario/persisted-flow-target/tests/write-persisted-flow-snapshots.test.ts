import assert from "node:assert/strict";
import test from "node:test";
import type { EvidenceBundle } from "@fluxiq-web-extension/test-evidence";
import type { ExistingFlowExecution } from "../../../existing-flow-run.js";
import { writePersistedFlowSnapshots } from "../write-persisted-flow-snapshots.js";

const execution = {
  runId: "run.core",
  status: "succeeded",
  detail: { runId: "run.core", status: "succeeded" },
  actions: [{ actionType: "web.dom.click", status: "succeeded" }],
  events: [{ sequence: 1, kind: "node.started" }],
  actionTypes: new Map(),
} as unknown as ExistingFlowExecution;

test("Core's run detail, its durable actions and its events are written under the three names the bench reads back", async () => {
  const written: [string, unknown][] = [];
  const bundle = { writeStructured: async (name: string, value: unknown) => { written.push([name, value]); } } as unknown as EvidenceBundle;
  await writePersistedFlowSnapshots(bundle, execution);
  assert.deepEqual(written.map(([name]) => name), ["snapshots/runtime-run.json", "snapshots/runtime-actions.json", "snapshots/runtime-events.json"]);
  assert.deepEqual(written.map(([, value]) => value), [execution.detail, execution.actions, execution.events]);
});

/**
 * A failed write is not swallowed here: the bundle is the run's only durable
 * account of what the Flow did, and a snapshot that silently went missing would
 * leave `lab inspect` reporting a Flow that ran on no evidence.
 */
test("a write that fails propagates rather than leaving the bundle quietly short", async () => {
  const bundle = { writeStructured: async (name: string) => { if (name.endsWith("runtime-actions.json")) throw new Error("disk full"); } } as unknown as EvidenceBundle;
  await assert.rejects(() => writePersistedFlowSnapshots(bundle, execution), /disk full/u);
});
